// Expo Web sử dụng CSS modules và CSS globals; TypeScript không suy luận
// nội dung style từ .css, nên khai báo module để typecheck cả native + Web.
declare module '*.module.css' {
  const styles: Readonly<Record<string, string>>;
  export default styles;
}

declare module '*.css';
