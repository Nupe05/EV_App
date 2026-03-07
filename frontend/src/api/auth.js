import { api } from "./client";

export async function login(apiClient, username, password) {
    const res = await apiClient.post("/auth/token/", { username, password });
    return res.data; // { access, refresh }
  }