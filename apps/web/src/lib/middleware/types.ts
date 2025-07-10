import { NextRequest, NextResponse } from 'next/server';

export type NextMiddlewareFunction = (
  request: NextRequest,
  response?: NextResponse,
) => Promise<NextResponse | undefined>;

export type NextMiddlewareChain = NextMiddlewareFunction[];
