(function () {
  const cfg = window.RETAC_CONFIG || {};

  window.retacSupabase =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    window.supabase
      ? window.supabase.createClient(
          cfg.SUPABASE_URL,
          cfg.SUPABASE_ANON_KEY
        )
      : null;

  const sb = window.retacSupabase;

  function notReady(name) {
    return new Error(
      'Standalone API not configured/migrated yet: ' + name
    );
  }

  // ==========================================
  // LOGIN
  // Username -> Supabase email -> Authentication
  // ==========================================

  async function suiteLogin(username, password) {
    if (!sb) {
      throw new Error('Supabase connection is not configured.');
    }

    username = String(username || '').trim();
    password = String(password || '');

    if (!username || !password) {
      return {
        ok: false,
        message: 'Enter username and password.'
      };
    }

    // Get the hidden Supabase email for this RETAC username
    const { data: email, error: lookupError } = await sb.rpc(
      'get_login_email',
      {
        login_username: username
      }
    );

    if (lookupError) {
      console.error('Username lookup error:', lookupError);

      return {
        ok: false,
        message: 'Unable to verify username.'
      };
    }

    if (!email) {
      return {
        ok: false,
        message: 'Invalid username or password.'
      };
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } =
      await sb.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (authError || !authData.user) {
      console.error('Login error:', authError);

      return {
        ok: false,
        message: 'Invalid username or password.'
      };
    }

    // Load RETAC profile
    const { data: profile, error: profileError } =
      await sb
        .from('user_profiles')
        .select(
          'id, username, display_name, department, role, active'
        )
        .eq('id', authData.user.id)
        .single();

    if (profileError || !profile) {
      await sb.auth.signOut();

      return {
        ok: false,
        message: 'RETAC user profile was not found.'
      };
    }

    if (!profile.active) {
      await sb.auth.signOut();

      return {
        ok: false,
        message: 'This account is disabled.'
      };
    }

    return {
      ok: true,
      user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        department: profile.department,
        role: profile.role
      }
    };
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function suiteLogout() {
    if (!sb) return { ok: true };

    const { error } = await sb.auth.signOut();

    if (error) throw error;

    return { ok: true };
  }

  // ==========================================
  // CURRENT SESSION
  // ==========================================

  async function getCurrentRetacUser() {
    if (!sb) return null;

    const {
      data: { session }
    } = await sb.auth.getSession();

    if (!session || !session.user) return null;

    const { data: profile, error } =
      await sb
        .from('user_profiles')
        .select(
          'id, username, display_name, department, role, active'
        )
        .eq('id', session.user.id)
        .single();

    if (error || !profile || !profile.active) {
      return null;
    }

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      department: profile.department,
      role: profile.role
    };
  }

  // ==========================================
  // MIGRATED DIRECT DATABASE CALLS
  // ==========================================

  async function invoke(name, args) {
    if (!sb) {
      throw new Error(
        'Add SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js first.'
      );
    }

    const direct = {
      suiteLogin: async (username, password) =>
        suiteLogin(username, password),

      suiteLogout: async () =>
        suiteLogout(),

      getCurrentRetacUser: async () =>
        getCurrentRetacUser(),

      getStockRows: async () =>
        await sb
          .from('stock_batches')
          .select('*')
          .order('expiry', { ascending: true }),

      getSearchData: async () => {
        const [c, l] = await Promise.all([
          sb.from('custody').select('*'),
          sb.from('loans').select('*')
        ]);

        if (c.error) throw c.error;
        if (l.error) throw l.error;

        return {
          custody: c.data || [],
          loans: l.data || []
        };
      }
    };

    if (direct[name]) {
      const r = await direct[name](...(args || []));

      if (r && r.error) throw r.error;

      return r && 'data' in r ? r.data : r;
    }

    throw notReady(name);
  }

  // ==========================================
  // GOOGLE.SCRIPT.RUN COMPATIBILITY
  // Keeps the original RETAC interface working
  // ==========================================

  function chain(ok, fail, user) {
    return new Proxy(
      {},
      {
        get(_, name) {
          if (name === 'withSuccessHandler')
            return f => chain(f, fail, user);

          if (name === 'withFailureHandler')
            return f => chain(ok, f, user);

          if (name === 'withUserObject')
            return v => chain(ok, fail, v);

          return (...args) => {
            invoke(String(name), args)
              .then(r => ok && ok(r, user))
              .catch(e =>
                fail ? fail(e, user) : console.error(e)
              );
          };
        }
      }
    );
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = chain();

  window.retacInvoke = invoke;
  window.retacLogin = suiteLogin;
  window.retacLogout = suiteLogout;
  window.getCurrentRetacUser = getCurrentRetacUser;
})();