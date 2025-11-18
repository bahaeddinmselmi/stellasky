package com.bahaeddin.stellassky

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class MoodWidgetModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun updateMoodWidget(emoji: String, title: String, note: String?, imageUrl: String?) {
    val content = MoodWidgetContent(
      emoji = emoji,
      title = title,
      note = note?.takeIf { it.isNotBlank() },
      imageUrl = imageUrl?.takeIf { it.isNotBlank() },
      updatedAt = System.currentTimeMillis(),
    )

    MoodWidgetStorage.save(reactContext, content)

    UiThreadUtil.runOnUiThread {
      MoodWidgetUpdater.updateWidgets(reactContext, content)
    }

    MoodWidgetScheduler.ensureRefresh(reactContext)
    MoodWidgetRefreshWorker.enqueueImmediate(reactContext)
  }

  companion object {
    const val MODULE_NAME = "MoodWidget"
  }
}
