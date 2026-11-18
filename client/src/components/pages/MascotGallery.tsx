import { ArrowDown, ArrowLeft, ArrowUpRight, Check, Download, Layers, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { MASCOT_VARIANTS, type MascotVariant } from "../../lib/mascot";
import { loadUiPreferences } from "../../lib/uiPreferences";
import "../../styles/mascot-gallery.css";

// Live2D 仅在形象馆中加载，创作工作区不加载角色运行时。
const MascotLive2DStudio = lazy(() => import("./MascotLive2DStudio").then((module) => ({ default: module.MascotLive2DStudio })));

/** 独立的角色展示页；使用本地静态作品，切换风格不发起生成请求。 */
export function MascotGallery() {
  const [selectedId, setSelectedId] = useState<MascotVariant["id"]>("live2d");
  const [dark, setDark] = useState(() => loadUiPreferences().appearance.theme === "dark");
  const selected = MASCOT_VARIANTS.find((variant) => variant.id === selectedId) ?? MASCOT_VARIANTS[0];

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "AIDraw 形象馆 · 绘画少女";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <main className={`mascot-gallery${dark ? " mascot-gallery-dark" : ""}`}>
      <div className="mascot-gallery-inner">
        <header className="mascot-gallery-header">
          <a className="mascot-gallery-brand" href="/" aria-label="返回 AIDraw 创作空间">
            <span><Layers size={22} strokeWidth={1.6} /></span>
            <strong>AIDraw<small>CHARACTER STUDIO</small></strong>
          </a>
          <nav aria-label="形象馆导航">
            <a className="mascot-gallery-back" href="/"><ArrowLeft size={15} />返回创作空间</a>
            <button className="mascot-theme-button" type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? "切换到浅色" : "切换到深色"}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </header>

        <section className="mascot-gallery-hero" aria-labelledby="mascot-gallery-title">
          <div className="mascot-gallery-intro">
            <div className="mascot-eyebrow"><span /> MEET YOUR CREATIVE COMPANION</div>
            <h1 id="mascot-gallery-title">让灵感，<br /><em>有个可爱的模样。</em></h1>
            <p className="mascot-gallery-lead">从一张空白画布，到无数个新想法。<br />一位陪你把灵感画出来的绘画少女。</p>
            <div className="mascot-identity-tags"><span><Palette size={13} />为创作而生</span><span><Layers size={13} />叠层画框徽记</span><span><Sparkles size={13} />原创少女 · 动态陪伴</span></div>
            <a className="mascot-explore-link" href="#mascot-collection">探索她的不同模样<ArrowDown size={15} /></a>
            <div className="mascot-palette-note"><span className="mascot-color-sage" /><span className="mascot-color-ivory" /><span className="mascot-color-mint" /><small>鼠尾草绿 / 奶油白 / 薄荷</small></div>
          </div>

          <figure className={`mascot-art-stage mascot-accent-${selected.accent}`}>
            <div className="mascot-stage-topline"><span>AIDRAW ORIGINAL CHARACTER</span><span>{selected.number} / 04</span></div>
            <div className="mascot-art-halo" aria-hidden="true" />
            <div className="mascot-art-layers" aria-hidden="true"><i /><i /><i /></div>
            {selected.id === "live2d" ? <Suspense fallback={<div className="mascot-live2d-loading" role="status">正在准备 Live2D…</div>}><MascotLive2DStudio /></Suspense> : <img key={selected.id} className={`mascot-main-art mascot-main-art-${selected.id}`} src={selected.source} alt={`AIDraw 原创绘画少女，${selected.label}形象`} fetchPriority="high" decoding="async" />}
            <figcaption><span><i />{selected.label}</span><small>MADE FOR IMAGINATION</small></figcaption>
          </figure>
        </section>

        <section className="mascot-collection" id="mascot-collection" aria-labelledby="mascot-collection-title">
          <div className="mascot-section-heading"><div><span className="mascot-eyebrow">ONE CHARACTER, FOUR EXPRESSIONS</span><h2 id="mascot-collection-title">每一种模样，都有自己的可爱。</h2></div><span className="mascot-section-index">01 — 04</span></div>
          <div className="mascot-variant-grid" aria-label="选择形象风格">
            {MASCOT_VARIANTS.map((variant) => (
              <button className={`mascot-variant-card mascot-accent-${variant.accent}${selected.id === variant.id ? " is-selected" : ""}`} key={variant.id} type="button" aria-label={`查看${variant.label}形象`} aria-pressed={selected.id === variant.id} onClick={() => setSelectedId(variant.id)}>
                <div className="mascot-variant-topline"><span>{variant.number}</span>{selected.id === variant.id ? <Check size={15} /> : <ArrowUpRight size={15} />}</div>
                <img src={variant.source} alt="" loading="lazy" decoding="async" />
                <span className="mascot-variant-title">{variant.label}</span><small>{variant.english}</small>
              </button>
            ))}
          </div>
          <div className="mascot-selected-description" aria-live="polite">
            <div><span className="mascot-eyebrow">{selected.english}</span><h3>{selected.title}</h3><p>{selected.description}</p></div>
            <div className="mascot-download-actions">
              <a className="mascot-download-button" href={selected.source} download={`AIDraw-${selected.id}-v1.png`}><Download size={16} />下载透明 PNG</a>
            </div>
          </div>
        </section>

        <section className="mascot-icon-section" aria-labelledby="mascot-icon-title">
          <div className="mascot-icon-copy"><span className="mascot-eyebrow">SMALL ICON, SAME PERSONALITY</span><h2 id="mascot-icon-title">缩小，也能一眼认出她。</h2><p>{selected.detail}</p><span className="mascot-transparent-label"><span />透明底原图 · 自由搭配背景</span></div>
          <div className="mascot-icon-samples">
            <figure><div className="mascot-icon-light"><img src={selected.source} alt={`${selected.label}浅色图标预览`} loading="lazy" /></div><figcaption>浅色头像</figcaption></figure>
            <figure><div className="mascot-icon-dark"><img src={selected.source} alt={`${selected.label}深色图标预览`} loading="lazy" /></div><figcaption>深色头像</figcaption></figure>
            <figure><div className="mascot-icon-sage"><img src={selected.source} alt={`${selected.label}项目图标预览`} loading="lazy" /></div><figcaption>项目图标</figcaption></figure>
          </div>
        </section>

        <footer className="mascot-gallery-footer"><a href="/">AIDraw · 为灵感而生<ArrowUpRight size={14} /></a><span>一张画布，一个想法，一位创作搭档。</span></footer>
      </div>
    </main>
  );
}
