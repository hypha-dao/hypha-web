// Mock implementation of the next/image context
export const ImageContext = {
  Provider: ({ children }) => children,
  Consumer: ({ children }) => (children ? children({}) : null),
};
