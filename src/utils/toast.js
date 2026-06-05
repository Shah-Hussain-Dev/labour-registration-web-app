import toast from "react-hot-toast";

/**
 * App-wide toast helpers. Requires {@link AppToaster} mounted once near the app root.
 * @see https://react-hot-toast.com/
 */
export const showToast = {
  success(message, options) {
    if (!message) return null;
    return toast.success(String(message), options);
  },

  error(message, options) {
    if (!message) return null;
    return toast.error(String(message), options);
  },

  loading(message, options) {
    if (!message) return null;
    return toast.loading(String(message), options);
  },

  dismiss(toastId) {
    toast.dismiss(toastId);
  },

  dismissAll() {
    toast.dismiss();
  },

  promise(promise, messages, options) {
    return toast.promise(promise, messages, options);
  },
};
