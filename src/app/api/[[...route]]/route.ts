import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { createApi } from '../../../../worker/api.mjs';
import { seedPosts, defaultSettings } from '@/lib/content';

const api = createApi(seedPosts, defaultSettings);

function getEnv(): Record<string, any> {
  return {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_ADMIN_UIDS: process.env.FIREBASE_ADMIN_UIDS,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    AUTH_PROVIDER: process.env.AUTH_PROVIDER || 'firebase',
    CONTENT_PROVIDER: process.env.CONTENT_PROVIDER || 'firebase',
    MEDIA_PROVIDER: process.env.MEDIA_PROVIDER || 'cloudinary',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    PUBLIC_SITE: process.env.PUBLIC_SITE,
    SITE_URL: process.env.SITE_URL,
    ...process.env,
  };
}

async function handle(request: NextRequest) {
  try {
    return await api(request, getEnv());
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'The operation could not be completed.' },
      { status: error?.status || 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const dynamic = 'force-dynamic';

