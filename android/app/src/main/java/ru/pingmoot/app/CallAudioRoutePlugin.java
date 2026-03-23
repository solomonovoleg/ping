package ru.pingmoot.app;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallAudioRoute")
public class CallAudioRoutePlugin extends Plugin {

  @PluginMethod
  public void setOutputRoute(PluginCall call) {
    String mode = call.getString("mode");
    if (mode == null) mode = "speaker";
    android.app.Activity activity = getActivity();
    if (activity == null) {
      call.reject("no_activity");
      return;
    }
    activity.runOnUiThread(() -> {
      try {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) {
          call.reject("no_audio_manager");
          return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          boolean routed = false;
          int wantType =
              "speaker".equals(mode) ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
          for (AudioDeviceInfo device : am.getAvailableCommunicationDevices()) {
            if (device.getType() == wantType) {
              am.setCommunicationDevice(device);
              routed = true;
              break;
            }
          }
          if (routed) {
            call.resolve();
            return;
          }
          /* Пустой список на части устройств — fallback как на API < 31 */
        }
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        am.setSpeakerphoneOn("speaker".equals(mode));
        call.resolve();
      } catch (Exception e) {
        call.reject("audio_route_failed", e);
      }
    });
  }
}
