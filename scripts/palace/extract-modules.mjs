import { readFile, writeFile } from 'node:fs/promises';

const dump = JSON.parse(await readFile('scripts/palace/blueprints.dump.json', 'utf8'));
const wanted = ['顺高格', '顺高格有屋顶', '逆格', '田字格'];
const modules = {};
for (const name of wanted) {
  const bp = dump.find(item => item.name === name);
  if (!bp) throw new Error(`missing blueprint ${name}`);
  modules[name] = {
    source: `${bp.name} (${bp.cardCount} 张)`,
    cardSize: bp.cardSize,
    bounds: bp.bounds,
    cards: bp.cards.map(card => ({
      order: card.order,
      position: card.position,
      quaternion: card.quaternion,
      suit: card.suit,
      rank: card.rank,
      color: card.color,
    })),
  };
}
await writeFile('scripts/palace/modules.json', `${JSON.stringify({ note: '从客户端蓝图库导出的模块（用户自定义结构）', modules }, null, 2)}\n`, 'utf8');
for (const [name, module] of Object.entries(modules)) {
  const size = module.bounds?.size;
  console.log(`${name}: ${module.cards.length} 张, ${size ? size.map(v => v.toFixed(2)).join(' × ') : '?'}`);
}
