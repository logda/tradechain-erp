import { NextRequest } from 'next/server';
import { proxyProductRequest } from './_proxy';

export async function GET(request: NextRequest) {
  return proxyProductRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyProductRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyProductRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyProductRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyProductRequest(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyProductRequest(request);
}
