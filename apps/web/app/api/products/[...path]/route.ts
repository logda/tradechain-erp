import { NextRequest } from 'next/server';
import { proxyProductRequest } from '../_proxy';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyProductRequest(request, params.path ?? []);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyProductRequest(request, params.path ?? []);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyProductRequest(request, params.path ?? []);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyProductRequest(request, params.path ?? []);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyProductRequest(request, params.path ?? []);
}
