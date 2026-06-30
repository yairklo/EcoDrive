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
    
    // Add cleartext traffic
    const application = androidManifest.manifest.application[0];
    application.$['android:usesCleartextTraffic'] = "true";
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
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

public class SystemOverlayModule extends ReactContextBaseJavaModule {
    private WindowManager windowManager;
    private View overlayView;
    private TextView titleView;
    private TextView line2View;
    private TextView line3View;

    public SystemOverlayModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SystemOverlayModule";
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getReactApplicationContext())) {
                android.content.Intent intent = new android.content.Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        android.net.Uri.parse("package:" + getReactApplicationContext().getPackageName()));
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
            }
            promise.resolve(true);
        } else {
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void updateOverlayData(ReadableMap data) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Context appContext = getReactApplicationContext().getApplicationContext();
                if (windowManager == null) {
                    windowManager = (WindowManager) appContext.getSystemService(Context.WINDOW_SERVICE);
                }

                if (overlayView == null) {
                    android.widget.LinearLayout layout = new android.widget.LinearLayout(appContext);
                    layout.setOrientation(android.widget.LinearLayout.VERTICAL);
                    layout.setGravity(Gravity.CENTER);
                    overlayView = layout;

                    titleView = new TextView(appContext);
                    titleView.setTextSize(16);
                    titleView.setTextColor(Color.WHITE);
                    titleView.setGravity(Gravity.CENTER);
                    titleView.setTypeface(null, android.graphics.Typeface.BOLD);

                    line2View = new TextView(appContext);
                    line2View.setTextSize(14);
                    line2View.setTextColor(Color.WHITE);
                    line2View.setGravity(Gravity.CENTER);

                    line3View = new TextView(appContext);
                    line3View.setTextSize(14);
                    line3View.setTextColor(Color.WHITE);
                    line3View.setGravity(Gravity.CENTER);

                    layout.addView(titleView);
                    layout.addView(line2View);
                    layout.addView(line3View);

                    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                            WindowManager.LayoutParams.WRAP_CONTENT,
                            WindowManager.LayoutParams.WRAP_CONTENT,
                            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O 
                                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY 
                                : WindowManager.LayoutParams.TYPE_PHONE,
                            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE 
                                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                            PixelFormat.TRANSLUCENT
                    );
                    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    params.y = 150;

                    overlayView.setOnTouchListener(new View.OnTouchListener() {
                        private int initialX;
                        private int initialY;
                        private float initialTouchX;
                        private float initialTouchY;

                        @Override
                        public boolean onTouch(View v, MotionEvent event) {
                            switch (event.getAction()) {
                                case MotionEvent.ACTION_DOWN:
                                    initialX = params.x;
                                    initialY = params.y;
                                    initialTouchX = event.getRawX();
                                    initialTouchY = event.getRawY();
                                    return true;
                                case MotionEvent.ACTION_MOVE:
                                    params.x = initialX + (int) (event.getRawX() - initialTouchX);
                                    params.y = initialY + (int) (event.getRawY() - initialTouchY);
                                    windowManager.updateViewLayout(overlayView, params);
                                    return true;
                            }
                            return false;
                        }
                    });

                    windowManager.addView(overlayView, params);
                }

                String state = data.hasKey("state") ? data.getString("state") : "A";
                String colorHex = data.hasKey("colorHex") ? data.getString("colorHex") : "#4ade80";

                GradientDrawable shape = new GradientDrawable();
                
                if ("A".equals(state)) {
                    shape.setShape(GradientDrawable.OVAL);
                    shape.setColor(Color.TRANSPARENT);
                    // 4dp green border stroke
                    int strokeWidth = (int) (4 * appContext.getResources().getDisplayMetrics().density);
                    shape.setStroke(strokeWidth, Color.parseColor(colorHex));
                    overlayView.setBackground(shape);
                    overlayView.setPadding(40, 40, 40, 40);
                    
                    titleView.setVisibility(View.GONE);
                    line2View.setVisibility(View.GONE);
                    line3View.setVisibility(View.GONE);
                } else if ("B".equals(state)) {
                    shape.setShape(GradientDrawable.OVAL);
                    shape.setColor(Color.parseColor(colorHex));
                    overlayView.setBackground(shape);
                    overlayView.setPadding(40, 40, 40, 40);
                    
                    titleView.setVisibility(View.GONE);
                    line2View.setVisibility(View.GONE);
                    line3View.setVisibility(View.GONE);
                } else {
                    shape.setShape(GradientDrawable.RECTANGLE);
                    shape.setCornerRadius(30);
                    shape.setColor(Color.parseColor(colorHex));
                    overlayView.setBackground(shape);
                    overlayView.setPadding(50, 30, 50, 30);
                    
                    titleView.setVisibility(View.VISIBLE);
                    line2View.setVisibility(View.VISIBLE);
                    line3View.setVisibility(View.VISIBLE);
                    
                    titleView.setText((data.hasKey("speedDelta") ? data.getString("speedDelta") : ""));
                    line2View.setText((data.hasKey("timePenalty") ? data.getString("timePenalty") : ""));
                    line3View.setText((data.hasKey("savings") ? data.getString("savings") : ""));
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
                    overlayView = null;
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

  // 3. Register Package in MainApplication (Java or Kotlin)
  config = withMainApplication(config, (config) => {
    let mainApp = config.modResults.contents;
    const isKotlin = config.modResults.language === 'kt' || mainApp.includes('fun getPackages()');
    
    if (isKotlin) {
      const importStatement = `import ${config.android.package || 'com.yairklo.client'}.SystemOverlayPackage\n`;
      if (!mainApp.includes('SystemOverlayPackage')) {
        mainApp = mainApp.replace(/import com\.facebook\.react\.PackageList/, `import com.facebook.react.PackageList\n${importStatement}`);
        if (mainApp.includes('add(MyReactNativePackage())')) {
          mainApp = mainApp.replace(/add\(MyReactNativePackage\(\)\)/, `add(MyReactNativePackage())\n        add(SystemOverlayPackage())`);
        } else {
          mainApp = mainApp.replace(/return PackageList\(this\)\.packages\.apply\s*\{/, `return PackageList(this).packages.apply {\n        add(SystemOverlayPackage())`);
        }
      }
    } else {
      const importStatement = `import ${config.android.package || 'com.yairklo.client'}.SystemOverlayPackage;\n`;
      if (!mainApp.includes('SystemOverlayPackage')) {
        mainApp = mainApp.replace(/import com\.facebook\.react\.PackageList;/, `import com.facebook.react.PackageList;\n${importStatement}`);
        mainApp = mainApp.replace(/return packages;/, `packages.add(new SystemOverlayPackage());\n      return packages;`);
      }
    }
    
    config.modResults.contents = mainApp;
    return config;
  });

  return config;
};

module.exports = withSystemOverlay;
