import { useEffect, useState } from "react";

export function useLocalStorage(key, initialValue = "") {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw ?? initialValue;
  });

  useEffect(() => {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue];
}