/* AidChain demo wallet — a MetaMask-free EIP-1193 fallback for local demos.
 *
 * Load it while the dashboard is open over http://localhost:8080 — paste this
 * one line into the browser console (F12 -> Console), then press Enter:
 *
 *   const s=document.createElement('script');s.src='/.build/demo-wallet.js';document.head.appendChild(s);
 *
 * If the browser asks you to type "allow pasting" first, do that, then paste again.
 * Reloading or navigating the page removes it; paste the line again to reinstall.
 *
 * What it is: a shim that forwards wallet calls to the local anvil chain at
 * http://127.0.0.1:8546. anvil signs for its own unlocked development
 * accounts, so this file contains NO private keys and cannot touch real
 * funds. It speaks to the local chain only (chain id 31337); every token it
 * moves is a valueless demo token, and it does not work against Sepolia.
 *
 * Switch the acting account from the console (deployer | ngo | reviewer |
 * donor, or 0-3), then click "Connect wallet" and "Check contracts" again in
 * the dashboard:
 *
 *   demoWallet.setAccount('ngo')
 *   demoWallet.current()      // who acts now
 *   demoWallet.restore()      // remove the demo wallet
 */
(function () {
  'use strict';
  var RPC = 'http://127.0.0.1:8546';
  var ACCOUNTS = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
  ];
  var NAMES = ['deployer', 'ngo', 'reviewer', 'donor'];
  var BADGE = 'color:#fff;background:#2b5be3;padding:1px 7px;border-radius:3px;font-weight:bold';

  if (window.demoWallet) {
    console.log('Demo wallet already installed — demoWallet.help() for usage.');
    return;
  }

  var current = 0;
  var rid = 0;
  var listeners = {};
  var previous = window.ethereum || null;

  function emit(ev, arg) {
    (listeners[ev] || []).slice().forEach(function (fn) {
      try { fn(arg); } catch (e) { console.error('Demo wallet: listener for "' + ev + '" failed', e); }
    });
  }

  function rpc(method, params) {
    return fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rid, method: method, params: params || [] })
    }).then(function (res) { return res.json(); }).catch(function () {
      throw new Error('Demo wallet: no local chain at ' + RPC + '. In the aidchain-v6 folder start the chain first: anvil --port 8546, then bash .build/deploy_local.sh (once), then try again.');
    }).then(function (j) {
      if (j && j.error) {
        var e = new Error(j.error.message || 'JSON-RPC error');
        e.code = j.error.code;
        e.data = j.error.data;
        throw e;
      }
      return j.result;
    });
  }

  function setAccount(who) {
    var i = typeof who === 'string' ? NAMES.indexOf(who.toLowerCase()) : who;
    if (typeof i !== 'number' || !isFinite(i) || Math.floor(i) !== i || i < 0 || i >= ACCOUNTS.length) {
      throw new Error('demoWallet.setAccount: use 0-' + (ACCOUNTS.length - 1) + ' or one of ' + NAMES.join('/'));
    }
    if (i === current) return ACCOUNTS[i];
    current = i;
    console.log('%cDEMO WALLET%c acting account -> ' + NAMES[i] + ' ' + ACCOUNTS[i], BADGE, '');
    console.log('The dashboard reconnects automatically when you use its "Act as" role dropdown; after a manual setAccount, click "Connect wallet" + "Check contracts" again.');
    emit('accountsChanged', [ACCOUNTS[i]]);
    return ACCOUNTS[i];
  }

  var shim = {
    isDemoWallet: true,
    request: function (args) {
      var method = args && args.method;
      var params = args && args.params;
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return Promise.resolve([ACCOUNTS[current]]);
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return Promise.resolve(null);
      if (method === 'wallet_getPermissions' || method === 'wallet_requestPermissions') return Promise.resolve([{ parentCapability: 'eth_accounts' }]);
      if (method === 'eth_sendTransaction') {
        var tx = (params && params[0]) || {};
        tx.from = ACCOUNTS[current];
      }
      return rpc(method, params);
    },
    on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    addListener: function (ev, fn) { shim.on(ev, fn); },
    removeListener: function (ev, fn) { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); }
  };

  window.ethereum = shim;
  window.demoWallet = {
    rpc: RPC,
    accounts: ACCOUNTS.slice(),
    roles: NAMES.slice(),
    current: function () { return ACCOUNTS[current]; },
    setAccount: setAccount,
    previous: previous,
    restore: function () {
      if (window.ethereum === shim) {
        if (previous) { window.ethereum = previous; } else { try { delete window.ethereum; } catch (e) { /* ignore */ } }
      }
      console.log('Demo wallet removed' + (previous ? '; the wallet installed before was restored.' : '.'));
    },
    help: function () {
      console.log('demoWallet.current() -> acting address');
      console.log('demoWallet.setAccount("deployer" | "ngo" | "reviewer" | "donor" | 0-3)');
      console.log('demoWallet.restore() -> remove the demo wallet');
    }
  };

  console.log('%cDEMO WALLET%c local chain 31337 only — valueless demo tokens, no real funds', BADGE, '');
  console.log('Accounts:');
  NAMES.forEach(function (n, i) { console.log('  ' + i + '  ' + n + '  ' + ACCOUNTS[i]); });
  console.log('Switch accounts with demoWallet.setAccount("ngo"). In the dashboard the "Act as" role dropdown (one-click demo panel) does this and reconnects in one step.');
  if (previous && !previous.isDemoWallet) console.warn('Demo wallet replaced the window.ethereum that was already on this page. The original is kept at demoWallet.previous — call demoWallet.restore() to put it back.');

  rpc('eth_chainId').then(function (id) {
    console.log('Demo wallet ready: local chain ' + id + ' at ' + RPC + ' — acting as ' + NAMES[current] + ' ' + ACCOUNTS[current] + '.');
  }).catch(function (e) { console.error(e.message); });
})();
