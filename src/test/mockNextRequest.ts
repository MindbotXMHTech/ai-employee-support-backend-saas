import { NextRequest } from "next/server";

export function jsonRequest(url: string, body: unknown, headers?: HeadersInit) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

export function getRequest(url: string, headers?: HeadersInit) {
  return new NextRequest(url, {
    method: "GET",
    headers,
  });
}
