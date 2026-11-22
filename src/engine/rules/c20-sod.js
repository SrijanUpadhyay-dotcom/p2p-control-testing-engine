import { splitList } from '../util.js';
import { SOD_PAIRS } from '../rcm.js';

export default {
  id: 'C20',
  name: 'Segregation of duties',
  type: 'Detective',
  risk: 'R15',
  subprocess: 'SAP access',
  assertion: 'All',
  coso: 'P11',
  fraud: true,
  needs: ['user_access'],
  populationOf: 'user_access',
  logic: 'Builds each user\'s transaction codes from all assigned roles and flags any user holding both sides of a P2P conflict pair.',
  params: [
    { key: 'pairs', label: 'Conflict pairs', type: 'readonly', default: SOD_PAIRS.map((x) => x.id).join(';') }
  ],
  run(ctx, p) {
    const users = new Map();
    for (const r of ctx.data.user_access) {
      const id = (r.BNAME || '').toUpperCase();
      if (!id) continue;
      if (!users.has(id)) users.set(id, { id, name: r.USER_NAME, dept: r.DEPARTMENT, roles: [], codes: new Map() });
      const u = users.get(id);
      u.roles.push(r.AGR_NAME);
      for (const t of splitList(r.TCODES).map((s) => s.toUpperCase())) {
        if (!u.codes.has(t)) u.codes.set(t, []);
        u.codes.get(t).push(r.AGR_NAME);
      }
    }
    const active = new Set(splitList(p.pairs));
    const out = [];
    for (const u of users.values()) {
      for (const pair of SOD_PAIRS) {
        if (active.size && !active.has(pair.id)) continue;
        const a = pair.a.filter((t) => u.codes.has(t));
        const b = pair.b.filter((t) => u.codes.has(t));
        if (!a.length || !b.length) continue;
        const rolesA = [...new Set(a.flatMap((t) => u.codes.get(t)))];
        const rolesB = [...new Set(b.flatMap((t) => u.codes.get(t)))];
        out.push({
          key: `${u.id}-${pair.id}`,
          title: `SoD conflict: ${pair.aName} + ${pair.bName}`,
          record: `User ${u.id} · ${a.join('/')} + ${b.join('/')}`,
          vendor: null,
          party: `${u.name || u.id} · ${u.dept || 'SAP access'}`,
          amount: null,
          moneyOut: false,
          reasons: [`${pair.id}: ${pair.risk.toLowerCase()}`],
          facts: [
            { k: 'User', v: `${u.id}${u.name ? ' · ' + u.name : ''}` },
            { k: 'Department', v: u.dept || '—' },
            { k: pair.aName, v: `${a.join(', ')} via ${rolesA.join(', ')}`, bad: true },
            { k: pair.bName, v: `${b.join(', ')} via ${rolesB.join(', ')}`, bad: true },
            { k: 'Conflict', v: `${pair.id} · ${pair.risk}` },
            { k: 'Roles held', v: u.roles.join(', ') }
          ],
          condition: `User ${u.id}${u.name ? ` (${u.name}, ${u.dept})` : ''} holds ${a.join('/')} through ${rolesA.join(', ')} and ${b.join('/')} through ${rolesB.join(', ')}. Together these allow the user to ${pair.risk.toLowerCase()} (${pair.id}).`
        });
      }
    }
    return { population: users.size, exceptions: out };
  }
};
