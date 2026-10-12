import { articles } from '@/lib/articles';
import { ArticlePage } from '@/components/news-site';
import { notFound } from 'next/navigation';
export function generateStaticParams(){return articles.map(a=>({slug:a.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params; const a=articles.find(a=>a.slug===slug);return {title:a?.title,description:a?.excerpt}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const article=articles.find(a=>a.slug===slug);if(!article)notFound();return <ArticlePage article={article}/>}
