const { withDangerousMod, withAndroidManifest, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSystemOverlay = (config) => {
  // 1. Add SYSTEM_ALERT_WINDOW Permission
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    const hasPermission = androidManifest.manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.SYSTEM_ALERT_WINDOW'
    );
    if (!hasPermission) {
      androidManifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW' },
      });
    }
    
    // Add Waze and Geo intent queries for Android 11+
    if (!androidManifest.manifest.queries) {
      androidManifest.manifest.queries = [];
    }
    
    // Push the intents safely into the queries array
    const queriesArray = androidManifest.manifest.queries;
    if (queriesArray.length === 0 || !queriesArray[0].intent) {
      queriesArray[0] = { intent: [] };
    }
    
    const intents = queriesArray[0].intent;
    const hasWaze = intents.some(i => i.data && i.data.some(d => d.$['android:scheme'] === 'waze'));
    if (!hasWaze) {
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'waze' } }]
      });
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'geo' } }]
      });
    }
    
    return config;
  });

  // 2. Inject Java Module Source
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android.package || 'com.yairklo.client';
      const packagePath = packageName.replace(/\./g, '/');
      const javaDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', packagePath);

      if (!fs.existsSync(javaDir)) {
        fs.mkdirSync(javaDir, { recursive: true });
      }

      const moduleCode = `package ${packageName};

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SystemOverlayModule extends ReactContextBaseJavaModule {
    private WindowManager windowManager;
    private View overlayView;
    private TextView titleView;

    public SystemOverlayModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SystemOverlay";
    }

    @ReactMethod
    public void checkOverlayPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
        } else {
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void requestOverlayPermission(Promise promise) {
        // Just return false for this mock, in a real scenario we'd fire an Intent to ACTION_MANAGE_OVERLAY_PERMISSION
        promise.resolve(false); 
    }

    @ReactMethod
    public void showOverlay(String title, String colorHex) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Context appContext = getReactApplicationContext().getApplicationContext();
                if (windowManager == null) {
                    windowManager = (WindowManager) appContext.getSystemService(Context.WINDOW_SERVICE);
                }

                if (overlayView == null) {
                    overlayView = new TextView(appContext);
                    titleView = (TextView) overlayView;
                    titleView.setTextSize(18);
                    titleView.setTextColor(Color.WHITE);
                    titleView.setGravity(Gravity.CENTER);
                    titleView.setPadding(60, 30, 60, 30);
                }

                titleView.setText(title);

                GradientDrawable shape = new GradientDrawable();
                shape.setShape(GradientDrawable.RECTANGLE);
                shape.setCornerRadius(90);
                shape.setColor(Color.parseColor(colorHex));
                titleView.setBackground(shape);

                if (overlayView.getWindowToken() == null) {
                    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                            WindowManager.LayoutParams.WRAP_CONTENT,
                            WindowManager.LayoutParams.WRAP_CONTENT,
                            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O 
                                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY 
                                : WindowManager.LayoutParams.TYPE_PHONE,
                            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE 
                                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                            PixelFormat.TRANSLUCENT
                    );
                    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    params.y = 150;
                    windowManager.addView(overlayView, params);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @ReactMethod
    public void hideOverlay() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (windowManager != null && overlayView != null && overlayView.getWindowToken() != null) {
                    windowManager.removeView(overlayView);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
`;

      const packageCode = `package ${packageName};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SystemOverlayPackage implements ReactPackage {
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new SystemOverlayModule(reactContext));
        return modules;
    }
}
`;

      fs.writeFileSync(path.join(javaDir, 'SystemOverlayModule.java'), moduleCode);
      fs.writeFileSync(path.join(javaDir, 'SystemOverlayPackage.java'), packageCode);
      return config;
    }
  ]);

  // 3. Register Package in MainApplication.java
  config = withMainApplication(config, (config) => {
    let mainApp = config.modResults.contents;
    const importStatement = `import ${config.android.package || 'com.yairklo.client'}.SystemOverlayPackage;\n`;
    if (!mainApp.includes('SystemOverlayPackage')) {
      mainApp = mainApp.replace(/import com\.facebook\.react\.PackageList;/, `import com.facebook.react.PackageList;\n${importStatement}`);
      mainApp = mainApp.replace(
        /return packages;/,
        `packages.add(new SystemOverlayPackage());\n      return packages;`
      );
    }
    config.modResults.contents = mainApp;
    return config;
  });

  return config;
};

module.exports = withSystemOverlay;
