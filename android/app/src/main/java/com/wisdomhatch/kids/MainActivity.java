package com.wisdomhatch.kids;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Required by androidx.core:core-splashscreen (already a dependency, values/styles.xml
        // "AppTheme.NoActionBarLaunch") so the theme's windowSplashScreenAnimatedIcon actually
        // draws on API 24-30; on API 31+ the framework shows it from the theme alone, and this
        // call is a no-op passthrough. Must run before super.onCreate().
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
