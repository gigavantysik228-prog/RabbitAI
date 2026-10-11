// Rabbit AI для Windows: открывает Rabbit AI отдельным окном-приложением (через Edge/Chrome), без адресной строки.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <wchar.h>
#ifndef APP_URL
#define APP_URL L"https://rabbit-ai.onrender.com"
#endif

static int exists(const wchar_t *p) { DWORD a = GetFileAttributesW(p); return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY); }

static int find_browser(wchar_t *out) {
  const wchar_t *vars[] = { L"ProgramFiles(x86)", L"ProgramFiles", L"LOCALAPPDATA" };
  const wchar_t *rel[] = { L"\\Microsoft\\Edge\\Application\\msedge.exe", L"\\Google\\Chrome\\Application\\chrome.exe", L"\\BraveSoftware\\Brave-Browser\\Application\\brave.exe", L"\\Yandex\\YandexBrowser\\Application\\browser.exe" };
  wchar_t base[MAX_PATH];
  for (int r = 0; r < 4; r++)
    for (int v = 0; v < 3; v++)
      if (GetEnvironmentVariableW(vars[v], base, MAX_PATH)) {
        _snwprintf(out, MAX_PATH, L"%ls%ls", base, rel[r]);
        if (exists(out)) return 1;
      }
  return 0;
}

static void url_from_config(wchar_t *url) {
  // Можно переопределить адрес: файл rabbit-url.txt рядом с .exe
  wchar_t path[MAX_PATH]; GetModuleFileNameW(NULL, path, MAX_PATH);
  wchar_t *slash = wcsrchr(path, L'\\'); if (slash) wcscpy(slash + 1, L"rabbit-url.txt");
  HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
  if (h != INVALID_HANDLE_VALUE) {
    char buf[1024] = {0}; DWORD n = 0; ReadFile(h, buf, sizeof(buf) - 1, &n, NULL); CloseHandle(h);
    for (int i = n - 1; i >= 0 && (buf[i] == '\r' || buf[i] == '\n' || buf[i] == ' '); i--) buf[i] = 0;
    if (n > 8 && strncmp(buf, "http", 4) == 0) { MultiByteToWideChar(CP_UTF8, 0, buf, -1, url, 1024); return; }
  }
  wcscpy(url, APP_URL);
}

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE hp, PWSTR cmd, int show) {
  wchar_t url[1024], browser[MAX_PATH], data[MAX_PATH], args[4096];
  url_from_config(url);
  if (find_browser(browser)) {
    GetEnvironmentVariableW(L"LOCALAPPDATA", data, MAX_PATH);
    wcscat(data, L"\\RabbitAI");
    _snwprintf(args, 4096, L"--app=\"%ls\" --user-data-dir=\"%ls\" --window-size=1280,860 --no-first-run --no-default-browser-check", url, data);
    if ((INT_PTR)ShellExecuteW(NULL, L"open", browser, args, NULL, SW_SHOWNORMAL) > 32) return 0;
  }
  ShellExecuteW(NULL, L"open", url, NULL, NULL, SW_SHOWNORMAL);
  return 0;
}
