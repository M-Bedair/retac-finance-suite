(function(){
  const cfg=window.RETAC_CONFIG||{};
  window.retacSupabase = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase)
    ? window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY) : null;
  function notReady(name){return new Error('Standalone API not configured/migrated yet: '+name);}
  async function invoke(name,args){
    const sb=window.retacSupabase;
    if(!sb) throw new Error('Add SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js first.');
    // Direct browser-safe RPCs can be added here as migration proceeds.
    // Database tables already created in Supabase; RLS remains enabled by design.
    const direct={
      getStockRows: async()=> (await sb.from('stock_batches').select('*').order('expiry',{ascending:true})),
      getSearchData: async()=> {
        const [c,l]=await Promise.all([sb.from('custody').select('*'),sb.from('loans').select('*')]);
        if(c.error) throw c.error; if(l.error) throw l.error;
        return {custody:c.data||[],loans:l.data||[]};
      }
    };
    if(direct[name]){ const r=await direct[name](...(args||[])); if(r&&r.error)throw r.error; return r&&'data'in r?r.data:r; }
    throw notReady(name);
  }
  function chain(ok,fail,user){
    return new Proxy({}, {get(_,name){
      if(name==='withSuccessHandler') return f=>chain(f,fail,user);
      if(name==='withFailureHandler') return f=>chain(ok,f,user);
      if(name==='withUserObject') return v=>chain(ok,fail,v);
      return (...args)=>{invoke(String(name),args).then(r=>ok&&ok(r,user)).catch(e=>fail?fail(e,user):console.error(e));};
    }});
  }
  // Compatibility object for the original GAS front-end while functions are migrated.
  window.google=window.google||{}; window.google.script=window.google.script||{}; window.google.script.run=chain();
  window.retacInvoke=invoke;
})();
