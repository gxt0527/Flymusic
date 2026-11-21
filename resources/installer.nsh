; Custom NSIS hooks for FlyMusic.
;
; Why this exists:
;   The app stores everything under %APPDATA%\FlyMusic (see app.setName in
;   electron/main.js) - playlists, playback history, plugins, theme and the
;   Chromium cache. NSIS uninstall does NOT touch %APPDATA% by default, so a
;   "uninstall then reinstall" left all user data behind.
;
; Keep this file pure ASCII: makensis does not always read UTF-8 reliably.

; ------------------------------------------------------------------ uninstall
!macro customUnInstall
  ; electron-builder runs the old uninstaller with --updated while upgrading.
  ; User data must survive that path - wiping playlists / history / plugins on
  ; every update would be far worse than leaving a few megabytes behind.
  ${ifNot} ${isUpdated}
    ; Main user data: storage (history / plugins / playlists), Local Storage, caches
    RMDir /r "$APPDATA\FlyMusic"

    ; Older builds used a different app name for the same profile layout
    RMDir /r "$APPDATA\FlyMusicCheck"

    ; Roaming-independent leftovers
    RMDir /r "$LOCALAPPDATA\FlyMusic"

    ; electron-updater download cache (installer packages, ~80MB)
    RMDir /r "$LOCALAPPDATA\fly-music-updater"

    ; Cache directory pinned next to the executable (removed with $INSTDIR too,
    ; kept explicit in case the install dir is shared with other files)
    RMDir /r "$INSTDIR\FlyMusicCache"
  ${endif}
!macroend
