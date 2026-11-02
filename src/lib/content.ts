import { articles } from './articles';
import { englishArticles } from './english-articles';
export type Language = 'si' | 'en';
export type Translation = {title:string;excerpt:string;body:string[];alt:string};
export type Post = { id:string;slug:string;category:string;si:Translation;en:Translation;image:string;read:number;status:'draft'|'published'|'trash';featured:boolean;editorPick:boolean;breaking:boolean;sample:boolean;author:string;publishedAt:string;updatedAt:string;version:number };
export type SiteSettings = {facebookUrl:string;contactEmail:string;taglineSi:string;taglineEn:string};
export const defaultSettings:SiteSettings={facebookUrl:'',contactEmail:'',taglineSi:'ඔබේ හඬ. ඔබේ පුවත්.',taglineEn:'Your voice. Your news.'};
export const seedPosts:Post[]=articles.map((a,i)=>({id:a.slug,slug:a.slug,category:a.category,si:{title:a.title,excerpt:a.excerpt,body:a.body,alt:a.alt},en:englishArticles[i],image:`/images/${a.image}.webp`,read:a.read,status:'published',featured:i===0,editorPick:i===7,breaking:i<3,sample:true,author:'Desha News',publishedAt:'2026-10-12T10:00:00.000Z',updatedAt:`2026-10-12T${String(10-Math.floor(i/4)).padStart(2,'0')}:${String(59-i).padStart(2,'0')}:00.000Z`,version:0}));
export const categoryEnglish:Record<string,string>={'සියල්ල':'All','දේශීය':'Local','විදේශීය':'World','ව්‍යාපාර':'Business','ක්‍රීඩා':'Sports','තාක්ෂණය':'Technology','ජීවන රටා':'Lifestyle'};
export function categoryLabel(category:string,language:Language){return language==='en'?(categoryEnglish[category]||category):category}
export function postText(post:Post,language:Language){return post[language].title?post[language]:(language==='en'?post.si:post.en)}
export function postHref(post:Post,language:Language='si'){return `/article/?slug=${encodeURIComponent(post.slug)}&lang=${language}`}
export function editionHref(path:string,language:Language){const url=new URL(path,'https://desha.invalid');url.searchParams.set('lang',language);return `${url.pathname}${url.search}${url.hash}`}
