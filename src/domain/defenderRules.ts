// Defensive projection of the public community Assets API, client_version=6819.
// Tested against tests/fixtures/infernus-6819.public.json. Not an attack model.
export const DEFENDER_RULES = {
  '1': {id:'1',name:'Infernus',className:'hero_inferno',health:830,healthGrowth:39,bulletGrowth:0,spiritGrowth:0,
    image:'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/inferno_card.webp'},
  '15': {id:'15',name:'Bebop',className:'hero_bebop',health:880,healthGrowth:52,bulletGrowth:.3,spiritGrowth:0,
    image:'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/bebop_card.webp'},
} as const;
