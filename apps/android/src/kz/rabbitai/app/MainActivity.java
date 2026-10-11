package kz.rabbitai.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private String lang = Locale.getDefault().toLanguageTag();
    private boolean ru() { String l = lang.toLowerCase(); for (String x : new String[]{"ru", "kk", "ky", "uk", "be", "uz", "tg", "tk", "hy", "az", "ka"}) if (l.startsWith(x)) return true; return false; }

    static final String DEFAULT_URL = BuildConfigUrl.URL;
    static final int REQ_FILE = 1, REQ_SPEECH = 2, REQ_MIC = 3;

    WebView web;
    ValueCallback<Uri[]> fileCallback;
    PermissionRequest pendingPermission;
    TextToSpeech tts;
    SharedPreferences prefs;

    String baseUrl() { return prefs.getString("url", DEFAULT_URL); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("rabbit", MODE_PRIVATE);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#FDF8FC"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " RabbitAIApp/1.0");

        web.addJavascriptInterface(new Bridge(), "RabbitAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = Uri.parse(baseUrl()).getHost();
                if (("https".equals(u.getScheme()) || "http".equals(u.getScheme())) && host != null && host.equals(u.getHost())) return false;
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { toast(ru() ? "Не удалось открыть ссылку" : "Couldn't open the link"); }
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadUrl("file:///android_asset/offline.html");
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript("(function(){var d=document.documentElement.classList.contains('dark');return d?'1':'0'})()", val -> applyBars("\"1\"".equals(val)));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(Intent.createChooser(i, ru() ? "Выбери файл" : "Choose a file"), REQ_FILE); }
                catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
            @Override
            public void onPermissionRequest(PermissionRequest r) {
                for (String res : r.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) r.grant(new String[]{res});
                        else { pendingPermission = r; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC); }
                        return;
                    }
                }
                r.deny();
            }
        });

        tts = new TextToSpeech(this, st -> { if (st == TextToSpeech.SUCCESS) tts.setLanguage(Locale.forLanguageTag(lang)); });

        String shared = null;
        Intent in = getIntent();
        if (in != null && Intent.ACTION_SEND.equals(in.getAction())) shared = in.getStringExtra(Intent.EXTRA_TEXT);
        if (b != null) web.restoreState(b);
        else web.loadUrl(baseUrl() + (shared != null ? "#ask=" + Uri.encode(shared) : ""));
    }

    void applyBars(boolean dark) {
        runOnUiThread(() -> {
            Window w = getWindow();
            int c = dark ? Color.BLACK : Color.parseColor("#FBE4F0");
            w.setStatusBarColor(c);
            w.setNavigationBarColor(dark ? Color.BLACK : Color.parseColor("#FDF8FC"));
            View d = w.getDecorView();
            int f = d.getSystemUiVisibility();
            f = dark ? (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            d.setSystemUiVisibility(f);
        });
    }

    void toast(String t) { runOnUiThread(() -> Toast.makeText(this, t, Toast.LENGTH_SHORT).show()); }

    class Bridge {
        @JavascriptInterface public String version() { return "1.0"; }
        @JavascriptInterface public void theme(boolean dark) { applyBars(dark); }
        @JavascriptInterface public void retry() { runOnUiThread(() -> web.loadUrl(baseUrl())); }
        @JavascriptInterface public String getUrl() { return baseUrl(); }
        @JavascriptInterface public void setUrl(String u) {
            if (u == null) return;
            u = u.trim(); if (!u.startsWith("http")) u = "https://" + u;
            while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
            prefs.edit().putString("url", u).apply();
            final String fu = u; runOnUiThread(() -> web.loadUrl(fu));
        }
        @JavascriptInterface public void speak(String text) {
            if (tts != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rabbit");
        }
        @JavascriptInterface public void stopSpeak() { if (tts != null) tts.stop(); }
        @JavascriptInterface public boolean speaking() { return tts != null && tts.isSpeaking(); }
        @JavascriptInterface public void listen() {
            runOnUiThread(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                i.putExtra(RecognizerIntent.EXTRA_PROMPT, ru() ? "Говори, я слушаю 🐰" : "Speak, I'm listening 🐰");
                try { startActivityForResult(i, REQ_SPEECH); } catch (Exception e) { toast(ru() ? "Голосовой ввод недоступен на этом устройстве" : "Voice input is not available on this device"); }
            });
        }
        @JavascriptInterface public void setLang(String l) {
            if (l == null || !l.matches("[A-Za-z]{2,3}(-[A-Za-z]{2,4})?")) return;
            lang = l;
            runOnUiThread(() -> { if (tts != null) tts.setLanguage(Locale.forLanguageTag(lang)); });
        }
        @JavascriptInterface public void save(String name, String base64, String mime) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Rabbit AI");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(data); }
                    toast((ru() ? "Сохранено: Загрузки/Rabbit AI/" : "Saved: Downloads/Rabbit AI/") + name);
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "");
                    dir.mkdirs();
                    File f = new File(dir, name);
                    try (FileOutputStream os = new FileOutputStream(f)) { os.write(data); }
                    toast((ru() ? "Сохранено: " : "Saved: ") + f.getAbsolutePath());
                }
            } catch (Exception e) { toast(ru() ? "Не удалось сохранить файл" : "Couldn't save the file"); }
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE && fileCallback != null) {
            Uri[] result = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount(); result = new Uri[n];
                    for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) result = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(result); fileCallback = null;
        } else if (req == REQ_SPEECH && res == RESULT_OK && data != null) {
            ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (r != null && !r.isEmpty()) {
                String t = r.get(0).replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
                web.evaluateJavascript("window.onAndroidSpeech && window.onAndroidSpeech('" + t + "')", null);
            }
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] p, int[] g) {
        if (req == REQ_MIC && pendingPermission != null) {
            if (g.length > 0 && g[0] == PackageManager.PERMISSION_GRANTED) pendingPermission.grant(pendingPermission.getResources());
            else pendingPermission.deny();
            pendingPermission = null;
        }
    }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override protected void onDestroy() { if (tts != null) tts.shutdown(); super.onDestroy(); }
}
