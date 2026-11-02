'use client';
import {createContext,useContext,useEffect,useState,useCallback} from 'react';
import {defaultSettings,type Language,type Post,type SiteSettings} from '@/lib/content';
type Context={language:Language;setLanguage:(l:Language)=>void;t:(si:string,en:string)=>string;posts:Post[];settings:SiteSettings;loading:boolean;error:string;reload:()=>void};
const SiteContext=createContext<Context>({language:'si',setLanguage:()=>{},t:si=>si,posts:[],settings:defaultSettings,loading:true,error:'',reload:()=>{}});
export function SiteProvider({children}:{children:React.ReactNode}){
 const [language,setLang]=useState<Language>('si');const [posts,setPosts]=useState<Post[]>([]);const [settings,setSettings]=useState(defaultSettings);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const setLanguage=useCallback((l:Language)=>{setLang(l);document.documentElement.lang=l;try{localStorage.setItem('desha-language',l)}catch{};const url=new URL(location.href);url.searchParams.set('lang',l);history.replaceState(null,'',url);for(const link of document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')){const canonical=new URL(link.href);canonical.searchParams.set('lang',l);link.href=canonical.href}},[]);
 useEffect(()=>{const requested=new URLSearchParams(location.search).get('lang');if(requested==='si'||requested==='en'){setLanguage(requested);return}try{const saved=localStorage.getItem('desha-language');if(saved==='si'||saved==='en')setLanguage(saved)}catch{}},[setLanguage]);
 const reload=useCallback(()=>{setError('');setLoading(true);fetch('/api/public',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Content unavailable');return r.json()}).then(data=>{setPosts(data.posts);setSettings({...defaultSettings,...data.settings})}).catch(()=>setError('Content unavailable')).finally(()=>setLoading(false));},[]);
 useEffect(()=>{reload()},[reload]);
 return <SiteContext.Provider value={{language,setLanguage,t:(si,en)=>language==='si'?si:en,posts:posts.filter(p=>!!p[language].title),settings,loading,error,reload}}>{children}</SiteContext.Provider>
}
export function useSite(){return useContext(SiteContext)}
export function LanguageSwitch(){const {language,setLanguage}=useSite();return <div className="language-switch" role="group" aria-label="Choose language"><button type="button" lang="si" aria-pressed={language==='si'} onClick={()=>setLanguage('si')}>සිංහල</button><span/> <button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>English</button></div>}
