import { Toaster } from "react-hot-toast";

const baseStyle = {
  maxWidth: "min(24rem, calc(100vw - 2rem))",
  padding: "0.75rem 1rem",
  fontSize: "0.9375rem",
  lineHeight: 1.45,
  borderRadius: "10px",
  boxShadow: "0 4px 20px rgba(20, 22, 34, 0.12)",
};

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={10}
      containerStyle={{
        top: "max(0.75rem, env(safe-area-inset-top, 0px))",
      }}
      toastOptions={{
        duration: 4500,
        style: {
          ...baseStyle,
          background: "#fff",
          color: "#141622",
          border: "1px solid #e2e6f0",
        },
        success: {
          duration: 4000,
          style: {
            ...baseStyle,
            background: "color-mix(in srgb, #7cbf45 14%, white)",
            color: "#2d5016",
            border: "1px solid color-mix(in srgb, #7cbf45 45%, white)",
          },
          iconTheme: {
            primary: "#5f9a32",
            secondary: "#fff",
          },
        },
        error: {
          duration: 5500,
          style: {
            ...baseStyle,
            background: "color-mix(in srgb, #c62828 10%, white)",
            color: "#7f1d1d",
            border: "1px solid color-mix(in srgb, #c62828 35%, white)",
          },
          iconTheme: {
            primary: "#c62828",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
