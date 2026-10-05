import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Attach Authorization header and x-organization-id
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  try {
    const rawOrg = localStorage.getItem("org-storage");
    if (rawOrg) {
      const parsed = JSON.parse(rawOrg);
      if (parsed?.state?.activeOrg?._id) {
        config.headers["x-organization-id"] = parsed.state.activeOrg._id;
      }
    }
  } catch {
    // Ignore parse error
  }
  return config;
});

// Handle 401 - redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes("/login") && !window.location.pathname.includes("/register")) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
