const base = '/assets/capabilities/workshop';

export const workshopPhotos = [
  ['workshop-overview', 'Inside the production workshop', 'Furnaces, transfer equipment and extraction ducting share one production area.'],
  ['furnace-feed', 'Screws at the furnace conveyor', 'A broad bed of screws is spread across the mesh belt at the furnace opening.'],
  ['mesh-belt-screws', 'Socket-head screws on the mesh belt', 'A closer view shows the screw heads, threads and woven conveyor surface.'],
  ['furnace-heating', 'At the heated furnace opening', 'The furnace glow illuminates the screws passing through this section of the line.'],
  ['bath-conveyor', 'Conveyor beside the process bath', 'Screws rest on an inclined mesh conveyor alongside the process liquid.'],
  ['screw-transfer', 'Transfer between line sections', 'The inclined conveyor carries screws through the blue transfer assembly.'],
  ['heat-treatment-line', 'Continuous furnace equipment', 'Pipes, valves and guarded furnace sections extend along the workshop aisle.'],
  ['furnace-panels', 'Furnace section detail', 'Vented orange panels and overhead pipework show another view of the equipment.'],
  ['process-bath', 'Process bath detail', 'An overhead view brings the tank, liquid surface and adjacent conveyor into focus.'],
];

export const productionRoute = '/capabilities/production-line';
export const productionMeta = {
  title: 'Screw Production Line | Near Fastener',
  description: 'Explore screw production through loading, conveying, furnace heating, process-bath equipment and transfer.',
  file: 'capabilities/production-line.html',
};

const stages = [
  ['overview', 'Workshop overview', [0]],
  ['loading', 'Loading and mesh-belt conveying', [1, 2]],
  ['heating', 'Furnace and heating', [6, 7, 3]],
  ['bath', 'Process bath and conveyor', [8, 4]],
  ['transfer', 'Transfer between line sections', [5]],
];

function photo([id, title, description]) {
  return `<figure class="production-photo"><img src="${base}/${id}-v2.webp" alt="${title}" width="1440" height="1080" loading="lazy" decoding="async"><figcaption><h3>${title}</h3><p>${description}</p></figcaption></figure>`;
}

export function aboutProductionStory() {
  const navigation = stages.map(([id, title]) => `<li><a href="#about-production-${id}">${title}</a></li>`).join('');
  const sections = stages.slice(1).map(([id, title, photos]) => {
    const [primary, ...details] = photos.map(index => workshopPhotos[index]);
    const supplementary = details.length ? `<div class="about-production-details">${details.map(([photoId, photoTitle]) => `<figure><img src="${base}/${photoId}-v2.webp" alt="${photoTitle}" width="1440" height="1080" loading="lazy" decoding="async"><figcaption>${photoTitle}</figcaption></figure>`).join('')}</div>` : '';
    return `<section id="about-production-${id}" class="about-production-stage" aria-labelledby="about-production-${id}-title"><figure class="about-production-primary"><img src="${base}/${primary[0]}-v2.webp" alt="${primary[1]}" width="1440" height="1080" loading="lazy" decoding="async"></figure><div class="about-production-copy"><h3 id="about-production-${id}-title">${title}</h3><p>${primary[2]}</p>${supplementary}</div></section>`;
  }).join('');
  return `<section id="production-story" class="about-production" aria-labelledby="about-production-title"><header id="about-production-overview" class="production-entry about-production-banner"><img class="production-entry-image" src="${base}/workshop-overview-v2.webp" alt="" aria-hidden="true" width="1440" height="1080" loading="lazy" decoding="async"><div class="max-w-max-content mx-auto px-4 lg:px-8 production-entry-inner"><div class="production-entry-copy"><span class="workshop-eyebrow">Production in focus</span><h2 id="about-production-title">Screw production line</h2><p>${productionMeta.description}</p></div><a class="workshop-button" href="#about-production-loading">Explore the production line</a><nav aria-label="Production line chapters"><ol class="production-chapters">${navigation}</ol></nav></div></header><div class="max-w-max-content mx-auto px-4 lg:px-8 about-production-flow">${sections}<div class="workshop-actions"><a class="workshop-button" href="${productionRoute}">Explore the production line</a><a href="/capabilities">Manufacturing Capabilities</a></div></div></section>`;
}

export function manufacturingProcessPage() {
  const navigation = stages.map(([id, title]) => `<li><a href="#${id}">${title}</a></li>`).join('');
  const sections = stages.map(([id, title, photos]) => `<section id="${id}" class="production-stage" aria-labelledby="${id}-title"><div class="production-stage-heading"><h2 id="${id}-title">${title}</h2></div><div class="production-stage-photos">${photos.map(index => photo(workshopPhotos[index])).join('')}</div></section>`).join('');
  return `<main id="main-content" class="flex-1"><div class="pt-20"><header class="production-header"><div class="production-container"><a class="production-back" href="/about#production-story">About Us</a><span class="workshop-eyebrow">Production in focus</span><h1>Screw production line</h1><p>${productionMeta.description}</p><nav aria-label="Production line chapters"><ol class="production-chapters">${navigation}</ol></nav></div></header><div class="production-container production-flow">${sections}<div class="workshop-actions"><a class="workshop-button" href="/rfq">Request a Quote</a><a href="/about#production-story">About Us</a><a href="/capabilities">Manufacturing Capabilities</a></div></div></div></main>`;
}

export function manufacturingPreview() {
  return `<section class="workshop-preview" aria-labelledby="production-example-title"><div class="max-w-max-content mx-auto px-4 lg:px-8"><div class="production-teaser"><img src="${base}/workshop-overview-v2.webp" alt="Inside the production workshop" width="1440" height="1080" loading="lazy" decoding="async"><div><span class="workshop-eyebrow">Production in focus</span><h2 id="production-example-title">Screw production line</h2><p>${productionMeta.description}</p><a class="workshop-button" href="${productionRoute}">Explore the production line</a></div></div></div></section>`;
}
