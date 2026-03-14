import axios from "axios";

function makeClient(baseURL = "/api") {
  return axios.create({
    baseURL,
    timeout: 15000,
  });
}

export const customerApi = makeClient("/api");
export const driverApi = makeClient("/api");

let customerAccessToken = "";
let customerRefreshToken = "";

let driverAccessToken = "";
let driverRefreshToken = "";

export function setCustomerTokens(access, refresh = null) {
  customerAccessToken = access || "";
  if (refresh !== null) customerRefreshToken = refresh || "";

  if (customerAccessToken) {
    customerApi.defaults.headers.common.Authorization = `Bearer ${customerAccessToken}`;
  } else {
    delete customerApi.defaults.headers.common.Authorization;
  }
}

export function setDriverTokens(access, refresh = null) {
  driverAccessToken = access || "";
  if (refresh !== null) driverRefreshToken = refresh || "";

  if (driverAccessToken) {
    driverApi.defaults.headers.common.Authorization = `Bearer ${driverAccessToken}`;
  } else {
    delete driverApi.defaults.headers.common.Authorization;
  }
}

async function refreshCustomerToken() {
  if (!customerRefreshToken) throw new Error("No customer refresh token");

  const res = await axios.post("/api/auth/refresh/", {
    refresh: customerRefreshToken,
  });

  const newAccess = res.data.access;
  setCustomerTokens(newAccess, customerRefreshToken);
  localStorage.setItem("demo_customer_access", newAccess);

  return newAccess;
}

async function refreshDriverToken() {
  if (!driverRefreshToken) throw new Error("No driver refresh token");

  const res = await axios.post("/api/auth/refresh/", {
    refresh: driverRefreshToken,
  });

  const newAccess = res.data.access;
  setDriverTokens(newAccess, driverRefreshToken);
  localStorage.setItem("demo_driver_access", newAccess);

  return newAccess;
}

customerApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const newAccess = await refreshCustomerToken();
        original.headers.Authorization = `Bearer ${newAccess}`;
        return customerApi(original);
      } catch (refreshErr) {
        setCustomerTokens("", "");
        localStorage.removeItem("demo_customer_access");
        localStorage.removeItem("demo_customer_refresh");
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

driverApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const newAccess = await refreshDriverToken();
        original.headers.Authorization = `Bearer ${newAccess}`;
        return driverApi(original);
      } catch (refreshErr) {
        setDriverTokens("", "");
        localStorage.removeItem("demo_driver_access");
        localStorage.removeItem("demo_driver_refresh");
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);