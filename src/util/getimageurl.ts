export const getImageUrl = (url: string) => {
  return `${process.env.BACKEND_URL}/uploads/${url}`;
};
