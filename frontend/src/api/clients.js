import axios from "axios";

function makeClient(baseURL = "/api") {
  return axios.create({
    baseURL,
    timeout: 15000,
  });
}

export const customerApi = makeClient("/api");
export const driverApi = makeClient("/api");

export function setCustomerToken(token) {
  if (token) customerApi.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete customerApi.defaults.headers.common.Authorization;
}

export function setDriverToken(token) {
  if (token) driverApi.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete driverApi.defaults.headers.common.Authorization;
}