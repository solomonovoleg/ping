package ru.pingmoot.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen.installSplashScreen(this);
    registerPlugin(CallAudioRoutePlugin.class);
    super.onCreate(savedInstanceState);
    // Edge-to-edge: WebView под системными панелями; отступы через CSS env(safe-area-inset-*) и viewport-fit=cover.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    createNotificationChannels();
  }

  /** Каналы FCM: обычные ЛС и отметки в сторис (другой приоритет / вибра). */
  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    NotificationChannel dm = new NotificationChannel(
      "ping_dm",
      "Сообщения",
      NotificationManager.IMPORTANCE_DEFAULT
    );
    dm.setDescription("Личные сообщения и чаты");
    nm.createNotificationChannel(dm);

    NotificationChannel story = new NotificationChannel(
      "ping_story_mention",
      "Отметки в историях",
      NotificationManager.IMPORTANCE_HIGH
    );
    story.setDescription("Когда вас отметили в сторис");
    story.enableVibration(true);
    story.setVibrationPattern(new long[] { 0, 240, 100, 240, 100, 280 });
    int rawId = getResources().getIdentifier("ping_story_mention", "raw", getPackageName());
    if (rawId != 0) {
      Uri sound =
          Uri.parse("android.resource://" + getPackageName() + "/" + rawId);
      AudioAttributes attrs =
          new AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build();
      story.setSound(sound, attrs);
    }
    nm.createNotificationChannel(story);

    NotificationChannel calls = new NotificationChannel(
      "ping_calls",
      "Звонки",
      NotificationManager.IMPORTANCE_HIGH
    );
    calls.setDescription("Входящие звонки");
    calls.enableVibration(true);
    calls.setVibrationPattern(new long[] { 0, 400, 200, 400, 200, 600 });
    nm.createNotificationChannel(calls);
  }
}
