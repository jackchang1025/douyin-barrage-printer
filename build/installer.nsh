; 自定义 NSIS 安装脚本 - 确保创建桌面快捷方式

!macro customInstall
  ; 强制为当前用户创建桌面快捷方式
  SetShellVarContext current
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}"
  
  ; 同时为所有用户创建（如果有权限）
  SetShellVarContext all
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}"
  
  ; 恢复到当前用户上下文
  SetShellVarContext current
!macroend

!macro customUnInstall
  ; 删除当前用户桌面快捷方式
  SetShellVarContext current
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  
  ; 删除所有用户桌面快捷方式
  SetShellVarContext all
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  
  SetShellVarContext current
!macroend
