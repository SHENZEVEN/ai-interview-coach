import Tesseract from 'tesseract.js';

// 图片OCR识别
export const parseImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      
      Tesseract.recognize(
        imageUrl,
        'chi_sim+eng', // 中文+英文混合识别
        {
          logger: (m) => console.log(m),
        }
      )
      .then(({ data: { text } }) => {
        resolve(text);
        URL.revokeObjectURL(imageUrl);
      })
      .catch((error) => {
        reject(error);
        URL.revokeObjectURL(imageUrl);
      });
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
};

// 检查文件是否为图片
export const isImageFile = (file: File): boolean => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
  return imageTypes.includes(file.type);
};

// 获取支持的图片格式
export const getSupportedImageFormats = (): string[] => {
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
};