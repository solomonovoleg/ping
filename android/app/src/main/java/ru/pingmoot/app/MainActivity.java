package ru.pingmoot.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(CallAudioRoutePlugin.class);
    super.onCreate(savedInstanceState);
    // Edge-to-edge: WebView под системными панелями; отступы через CSS env(safe-area-inset-*) и viewport-fit=cover.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
  }
}
