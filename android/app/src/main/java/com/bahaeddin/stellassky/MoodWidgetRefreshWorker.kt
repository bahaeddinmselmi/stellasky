package com.bahaeddin.stellassky

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class MoodWidgetRefreshWorker(
  context: Context,
  params: androidx.work.WorkerParameters,
) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    return try {
      MoodWidgetUpdater.pushStoredState(applicationContext)
      Result.success()
    } catch (e: Exception) {
      Result.retry()
    }
  }

  companion object {
    fun enqueueImmediate(context: Context) {
      val work = OneTimeWorkRequestBuilder<MoodWidgetRefreshWorker>()
        .setInitialDelay(5, TimeUnit.SECONDS)
        .build()

      WorkManager.getInstance(context).enqueueUniqueWork(
        "mood_widget_refresh_once",
        ExistingWorkPolicy.REPLACE,
        work,
      )
    }
  }
}
