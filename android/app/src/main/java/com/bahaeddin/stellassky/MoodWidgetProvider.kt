package com.bahaeddin.stellassky

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import android.text.format.DateUtils
import android.view.View
import android.widget.RemoteViews
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.bumptech.glide.Glide
import com.bumptech.glide.request.target.CustomTarget
import com.bumptech.glide.request.transition.Transition
import java.util.concurrent.TimeUnit

private const val PREFS_NAME = "mood_widget_prefs"
private const val KEY_EMOJI = "emoji"
private const val KEY_TITLE = "title"
private const val KEY_NOTE = "note"
private const val KEY_IMAGE_URL = "image_url"
private const val KEY_UPDATED_AT = "updated_at"

internal const val MOOD_WIDGET_REFRESH_WORK = "mood_widget_refresh"
internal const val ACTION_REFRESH_WIDGET = "com.bahaeddin.stellassky.action.REFRESH_MOOD_WIDGET"

data class MoodWidgetContent(
  val emoji: String,
  val title: String,
  val note: String?,
  val imageUrl: String?,
  val updatedAt: Long,
)

object MoodWidgetStorage {
  fun save(context: Context, content: MoodWidgetContent) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val editor = prefs.edit()
    editor.putString(KEY_EMOJI, content.emoji)
    editor.putString(KEY_TITLE, content.title)
    editor.putString(KEY_NOTE, content.note)
    editor.putString(KEY_IMAGE_URL, content.imageUrl)
    editor.putLong(KEY_UPDATED_AT, content.updatedAt)
    editor.apply()
  }

  fun load(context: Context): MoodWidgetContent {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val emoji = prefs.getString(KEY_EMOJI, "✨") ?: "✨"
    val title = prefs.getString(KEY_TITLE, context.getString(R.string.app_name))
      ?: context.getString(R.string.app_name)
    val note = prefs.getString(KEY_NOTE, null)
    val imageUrl = prefs.getString(KEY_IMAGE_URL, null)
    val updatedAt = prefs.getLong(KEY_UPDATED_AT, System.currentTimeMillis())
    return MoodWidgetContent(emoji, title, note, imageUrl, updatedAt)
  }
}

object MoodWidgetScheduler {
  fun ensureRefresh(context: Context) {
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
      .build()

    val work = PeriodicWorkRequestBuilder<MoodWidgetRefreshWorker>(30, TimeUnit.MINUTES)
      .setConstraints(constraints)
      .build()

    WorkManager.getInstance(context)
      .enqueueUniquePeriodicWork(
        MOOD_WIDGET_REFRESH_WORK,
        ExistingPeriodicWorkPolicy.UPDATE,
        work,
      )
  }
}

object MoodWidgetUpdater {
  fun pushStoredState(context: Context) {
    val content = MoodWidgetStorage.load(context)
    updateWidgets(context, content)
  }

  fun updateWidgets(context: Context, content: MoodWidgetContent) {
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, MoodWidgetProvider::class.java)
    val appWidgetIds = appWidgetManager.getAppWidgetIds(component)
    if (appWidgetIds.isEmpty()) return

    for (appWidgetId in appWidgetIds) {
      updateWidget(context, appWidgetManager, appWidgetId, content)
    }
  }

  private fun updateWidget(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    content: MoodWidgetContent,
  ) {
    val views = RemoteViews(context.packageName, R.layout.widget_mood)

    views.setTextViewText(R.id.moodEmoji, content.emoji)
    views.setTextViewText(R.id.moodTitle, content.title.ifBlank { context.getString(R.string.app_name) })

    val relative = DateUtils.getRelativeTimeSpanString(
      content.updatedAt,
      System.currentTimeMillis(),
      DateUtils.MINUTE_IN_MILLIS,
      DateUtils.FORMAT_ABBREV_RELATIVE,
    )
    views.setTextViewText(R.id.moodMeta, relative)

    if (content.note.isNullOrBlank()) {
      views.setViewVisibility(R.id.moodNote, View.GONE)
    } else {
      views.setTextViewText(R.id.moodNote, content.note)
      views.setViewVisibility(R.id.moodNote, View.VISIBLE)
    }

    views.setViewVisibility(R.id.moodImage, View.GONE)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    views.setOnClickPendingIntent(R.id.widgetRoot, pendingIntent)

    appWidgetManager.updateAppWidget(appWidgetId, views)

    if (!content.imageUrl.isNullOrBlank()) {
      loadImageAndApply(context, appWidgetManager, appWidgetId, views, content.imageUrl)
    }
  }

  private fun loadImageAndApply(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    remoteViews: RemoteViews,
    imageUrl: String,
  ) {
    Glide.with(context.applicationContext)
      .asBitmap()
      .load(imageUrl)
      .into(object : CustomTarget<Bitmap>() {
        override fun onResourceReady(resource: Bitmap, transition: Transition<in Bitmap>?) {
          remoteViews.setImageViewBitmap(R.id.moodImage, resource)
          remoteViews.setViewVisibility(R.id.moodImage, View.VISIBLE)
          appWidgetManager.updateAppWidget(appWidgetId, remoteViews)
        }

        override fun onLoadCleared(placeholder: Drawable?) {
          remoteViews.setViewVisibility(R.id.moodImage, View.GONE)
          appWidgetManager.updateAppWidget(appWidgetId, remoteViews)
        }

        override fun onLoadFailed(errorDrawable: Drawable?) {
          remoteViews.setViewVisibility(R.id.moodImage, View.GONE)
          appWidgetManager.updateAppWidget(appWidgetId, remoteViews)
        }
      })
  }
}

class MoodWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == ACTION_REFRESH_WIDGET || intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
      MoodWidgetUpdater.pushStoredState(context)
    }
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    MoodWidgetScheduler.ensureRefresh(context)
    MoodWidgetUpdater.pushStoredState(context)
  }

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    MoodWidgetUpdater.pushStoredState(context)
  }
}
