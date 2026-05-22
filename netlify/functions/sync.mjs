import { getStore } from "@netlify/blobs";

const API_KEY = Netlify.env.get("FOOTBALL_DATA_API_KEY");
const BASE = "https://api.football-data.org/v4";

const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

const TEAM_ALIASES = {
  bra:["brazil"],fra:["france"],arg:["argentina"],ger:["germany"],por:["portugal"],esp:["spain"],
  bel:["belgium"],col:["colombia"],cro:["croatia"],mar:["morocco"],
  usa:["united states","usa"],mex:["mexico"],jpn:["japan"],uru:["uruguay"],
  sui:["switzerland"],kor:["korea republic","south korea"],nor:["norway"],tur:["turkey","turkiye"],
  sco:["scotland"],aut:["austria"],swe:["sweden"],cze:["czech republic","czechia"],
  bih:["bosnia and herzegovina","bosnia & herzegovina","bosnia"],
  ecu:["ecuador"],par:["paraguay"],irn:["iran","ir iran"],irq:["iraq"],
  sau:["saudi arabia"],jor:["jordan"],qat:["qatar"],aus:["australia"],uzb:["uzbekistan"],
  egy:["egypt"],alg:["algeria"],tun:["tunisia"],gha:["ghana"],
  civ:["ivory coast","cote d'ivoire","cote divoire"],rsa:["south africa"],
  cod:["dr congo","congo dr","democratic republic of the congo"],
  cpv:["cape verde","cabo verde"],can:["canada"],pan:["panama"],
  nzl:["new zealand"],hat:["haiti"],cur:["curacao","curaçao"],sen:["senegal"],
};

const SCORER_ALIASES = {
  mbappe:["mbappe"],kane:["kane","harry kane"],messi:["messi"],haaland:["haaland"],
  yamal:["yamal"],vinicius:["vinicius"],ronaldo:["ronaldo","c. ronaldo"],
  alvarez:["j. alvarez","julian alvarez","j alvarez"],griezmann:["griezmann"],
  oyarzabal:["oyarzabal"],
};

const NAME_TO_ID = {};
for(const [id,aliases] of Object.entries(TEAM_ALIASES))for(const a of aliases)NAME_TO_ID[norm(a)]=id;

function findTeamId(apiName){
  if(!apiName)return null;
  const n=norm(apiName);
  if(NAME_TO_ID[n])return NAME_TO_ID[n];
  for(const [alias,id] of Object.entries(NAME_TO_ID))if(n.includes(alias)||alias.includes(n))return id;
  return null;
}
function findScorerId(playerName){
  if(!playerName)return null;
  const n=norm(playerName);
  for(const [id,aliases] of Object.entries(SCORER_ALIASES))for(const a of aliases)if(n.includes(norm(a)))return id;
  return null;
}

const STAGE_RANK={"ROUND_OF_32":1,"ROUND_OF_16":2,"QUARTER_FINALS":3,"SEMI_FINALS":4,"FINAL":5};
const RANK_TO_STAGE={1:"r32_exit",2:"r16_exit",3:"qf_exit",4:"sf_exit",5:"runner_up",6:"winner"};

export default async () => {
  if(!API_KEY){console.log("[sync] No API key");return;}
  const store=getStore({name:"wc26",consistency:"strong"});
  const state=await store.get("state",{type:"json"});
  if(!state?.setupComplete){console.log("[sync] Not set up");return;}

  const hdrs={"X-Auth-Token":API_KEY};
  try{
    const [sRes,mRes,scRes]=await Promise.all([
      fetch(`${BASE}/competitions/WC/standings`,{headers:hdrs}),
      fetch(`${BASE}/competitions/WC/matches`,{headers:hdrs}),
      fetch(`${BASE}/competitions/WC/scorers?limit=20`,{headers:hdrs}),
    ]);
    if(!sRes.ok||!mRes.ok||!scRes.ok){console.error("[sync] API error",sRes.status,mRes.status,scRes.status);return;}
    const [sd,md,scd]=await Promise.all([sRes.json(),mRes.json(),scRes.json()]);

    const teamScores={...(state.teamScores||{})};
    const scorerScores={...(state.scorerScores||{})};

    for(const group of sd?.standings||[]){
      if(group.type!=="TOTAL")continue;
      for(const row of group.table||[]){
        const id=findTeamId(row.team?.name);if(!id)continue;
        teamScores[id]={...(teamScores[id]||{})};
        teamScores[id].gw=row.won||0;
        teamScores[id].gd=row.draw||0;
      }
    }

    const kt={};
    const ensure=id=>{if(!kt[id])kt[id]={stageRank:0,qualified:false};};
    for(const match of md?.matches||[]){
      const rank=STAGE_RANK[match.stage];if(!rank)continue;
      const hId=findTeamId(match.homeTeam?.name),aId=findTeamId(match.awayTeam?.name);
      if(hId){ensure(hId);kt[hId].qualified=true;}
      if(aId){ensure(aId);kt[aId].qualified=true;}
      if(match.status!=="FINISHED")continue;
      const hp=match.score?.penalties?.home,ap=match.score?.penalties?.away;
      const hg=match.score?.fullTime?.home??0,ag=match.score?.fullTime?.away??0;
      const homeWon=(hp!=null&&ap!=null)?hp>ap:hg>ag;
      const wId=homeWon?hId:aId,lId=homeWon?aId:hId;
      if(lId){ensure(lId);if(rank>kt[lId].stageRank)kt[lId].stageRank=rank;}
      if(wId){ensure(wId);const wr=match.stage==="FINAL"?6:rank+1;if(wr>kt[wId].stageRank)kt[wId].stageRank=wr;}
    }

    for(const [id,info] of Object.entries(kt)){
      teamScores[id]={...(teamScores[id]||{})};
      teamScores[id].qualified=info.qualified;
      if(info.stageRank>0)teamScores[id].stage=RANK_TO_STAGE[info.stageRank];
    }

    for(const {player,goals} of scd?.scorers||[]){
      const id=findScorerId(player?.name);if(!id)continue;
      scorerScores[id]={...(scorerScores[id]||{})};
      scorerScores[id].g=goals||0;
    }

    await store.setJSON("state",{...state,teamScores,scorerScores,lastSynced:new Date().toISOString()});
    console.log("[sync] Done",new Date().toISOString());
  }catch(err){console.error("[sync] Error:",err);}
};

export const config={schedule:"*/30 * * * *"};
