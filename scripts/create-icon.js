/**
 * 创建默认应用图标
 * 使用方法: node scripts/create-icon.js
 * 
 * 注意：这只是一个简单的占位图标生成器
 * 建议使用专业设计的图标替换 build/icon.ico
 */

const fs = require('fs');
const path = require('path');

// 创建一个简单的 256x256 PNG 图标 (Base64 编码的占位图)
// 这是一个简单的蓝色渐变图标
const createPlaceholderIcon = () => {
  const buildDir = path.join(__dirname, '..', 'build');
  
  // 确保 build 目录存在
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  console.log('========================================');
  console.log('图标说明');
  console.log('========================================');
  console.log('');
  console.log('electron-builder 需要图标文件来打包应用。');
  console.log('');
  console.log('请准备以下图标文件放入 build 目录：');
  console.log('');
  console.log('Windows: build/icon.ico');
  console.log('  - 格式: ICO');
  console.log('  - 建议包含尺寸: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256');
  console.log('');
  console.log('Mac: build/icon.icns (如需 Mac 打包)');
  console.log('  - 格式: ICNS');
  console.log('');
  console.log('推荐工具：');
  console.log('  1. https://www.icoconverter.com/ - 在线 PNG 转 ICO');
  console.log('  2. https://iconverticons.com/online/ - 在线图标转换');
  console.log('  3. GIMP / Photoshop - 专业图像编辑软件');
  console.log('');
  console.log('========================================');
  console.log('');
  
  // 检查是否已有图标
  const icoPath = path.join(buildDir, 'icon.ico');
  const pngPath = path.join(buildDir, 'icon.png');
  
  if (fs.existsSync(icoPath)) {
    console.log('✓ 已存在 icon.ico 文件');
  } else if (fs.existsSync(pngPath)) {
    console.log('✓ 已存在 icon.png 文件 (electron-builder 会自动转换)');
  } else {
    console.log('✗ 未找到图标文件');
    console.log('');
    console.log('您可以：');
    console.log('1. 准备一个 256x256 或更大的 PNG 图片');
    console.log('2. 使用在线工具转换为 ICO 格式');
    console.log('3. 保存到 build/icon.ico');
  }
};

createPlaceholderIcon();

