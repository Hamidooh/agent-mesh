/**
 * AgentMesh — Swarm Visualizer Controller
 * Real-time WebSocket sync, interactive agent transcript, and HITL approvals.
 */

(function () {
  'use strict';

  /* ────────────────────────── State ────────────────────────── */
  let agents            = [];
  let goals             = [];
  let instances         = [];
  let selectedInstId    = null;
  let ws                = null;
  let wsReconnectDelay  = 1000;
  let isLaunching       = false;
  let feedPaused        = false;
  let pollingTimer      = null;

  /* ────────────────────── Utility: safe DOM ───────────────────── */
  function $(id) {
    return document.getElementById(id);
  }

  function setText(el, text) {
    if (el) el.textContent = String(text ?? '');
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ────────────────────── Element references ─────────────────── */
  const elWsStatus         = $('ws-status');
  const elTopologySelect   = $('topology-select');
  const elGoalSelect       = $('goal-select');
  const elBtnLaunch        = $('btn-launch-swarm');
  const elBtnCustomGoal    = $('btn-custom-goal');
  const elGoalDrawer       = $('goal-drawer');
  const elBtnCloseGoal     = $('btn-close-goal');
  const elCustomTitle      = $('custom-goal-title');
  const elCustomDesc       = $('custom-goal-desc');

  const elActiveTitle      = $('active-swarm-title');
  const elActiveBadge      = $('active-status-badge');
  const elActiveMeta       = $('active-meta-text');
  const elActiveControls   = $('active-controls');
  const elBtnCancelSwarm   = $('btn-cancel-swarm');

  const elAgentsRibbon     = $('agents-ribbon');
  const elInstancesList    = $('instances-list');
  const elBtnRefresh       = $('btn-refresh-history');

  const elTranscriptFeed   = $('transcript-feed');
  const elBtnPauseFeed     = $('btn-pause-feed');
  const elBtnClearFeed     = $('btn-clear-feed');

  const elApprovalsList    = $('approvals-list');
  const elPendingCount     = $('pending-count');
  const elToolsHistory     = $('tools-history');

  const elVerdictStatus    = $('verdict-status');
  const elConfidenceScore  = $('confidence-score');
  const elVerdictSynthesis = $('verdict-synthesis');

  const elMemorySearchInput= $('memory-search-input');
  const elBtnSearchMemory  = $('btn-search-memory');
  const elMemoryResults    = $('memory-results');

  const elMetricSwarms     = $('metric-total-swarms');
  const elMetricActive     = $('metric-active-swarms');
  const elMetricConsensus  = $('metric-consensus-rate');
  const elMetricToolCalls  = $('metric-tool-calls');
  const elMetricDebateTurns= $('metric-debate-turns');

  /* ────────────────────── Custom Goal Drawer ──────────────────── */
  if (elBtnCustomGoal && elGoalDrawer) {
    elBtnCustomGoal.addEventListener('click', () => {
      const hidden = elGoalDrawer.style.display === 'none';
      elGoalDrawer.style.display = hidden ? 'block' : 'none';
    });
  }
  if (elBtnCloseGoal && elGoalDrawer) {
    elBtnCloseGoal.addEventListener('click', () => {
      elGoalDrawer.style.display = 'none';
    });
  }

  /* ─────────────────────── Tab Switching ──────────────────────── */
  document.querySelectorAll('.tab-item').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-item').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      if (target) document.getElementById(target)?.classList.add('active');
    });
  });

  /* ─────────────────── Transcript Feed Controls ───────────────── */
  if (elBtnPauseFeed) {
    elBtnPauseFeed.addEventListener('click', () => {
      feedPaused = !feedPaused;
      elBtnPauseFeed.textContent = feedPaused ? '▶ Resume' : '⏸ Pause';
    });
  }

  if (elBtnClearFeed && elTranscriptFeed) {
    elBtnClearFeed.addEventListener('click', () => {
      elTranscriptFeed.innerHTML = '<div class="empty-hint">Feed cleared.</div>';
    });
  }

  /* ─────────────────────── WebSocket ─────────────────────────── */
  function setWsStatus(connected) {
    if (!elWsStatus) return;
    const dot = elWsStatus.querySelector('.status-dot');
    const text = elWsStatus.querySelector('.status-text');
    if (connected) {
      elWsStatus.style.background = 'var(--badge-green-bg)';
      elWsStatus.style.color = 'var(--badge-green-text)';
      if (dot) dot.style.background = 'var(--badge-green-text)';
      if (text) text.textContent = 'Live Sync';
      wsReconnectDelay = 1000;
    } else {
      elWsStatus.style.background = 'var(--badge-amber-bg)';
      elWsStatus.style.color = 'var(--badge-amber-text)';
      if (dot) dot.style.background = 'var(--badge-amber-text)';
      if (text) text.textContent = 'Reconnecting…';
    }
  }

  function initWebSocket() {
    if (ws && ws.readyState <= 1) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
      setWsStatus(true);
    };

    ws.onclose = () => {
      setWsStatus(false);
      ws = null;
      wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 30000);
      setTimeout(initWebSocket, wsReconnectDelay);
    };

    ws.onerror = (err) => {
      console.warn('[AgentMesh] WebSocket error:', err);
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); }
      catch { return; }

      if (msg.type === 'INIT_STATE') {
        agents = Array.isArray(msg.agents) ? msg.agents : [];
        instances = Array.isArray(msg.instances) ? msg.instances : [];
        renderAgentsRibbon();
        renderHistoryList();
        renderApprovals(msg.pendingApprovals || []);
        if (msg.metrics) updateMetrics(msg.metrics);
        loadGoals();

        if (instances.length > 0 && !selectedInstId) {
          selectInstance(instances[instances.length - 1].id);
        }
      } else if (msg.type === 'SWARM_EVENT') {
        if (msg.metrics) updateMetrics(msg.metrics);
        if (msg.pendingApprovals) renderApprovals(msg.pendingApprovals);

        const evt = msg.event;
        if (!evt) return;

        if (evt.type === 'AGENT_THINKING') {
          highlightThinkingAgent(evt.agentId);
        } else if (evt.type === 'AGENT_MESSAGE') {
          if (evt.payload) appendTranscriptMessage(evt.payload);
        } else if (evt.type === 'TOOL_INVOKED') {
          if (evt.payload) appendToolRecord(evt.payload);
        } else if (evt.type === 'CONSENSUS_EVALUATED') {
          if (evt.payload) renderVerdict(evt.payload);
        } else if (evt.type === 'SWARM_COMPLETED' || evt.type === 'SWARM_FAILED') {
          clearThinkingAgents();
          fetchInstances();
        }
      }
    };
  }

  /* ─────────────────────── Load Goals ─────────────────────────── */
  async function loadGoals() {
    try {
      const res = await fetch('/api/goals');
      if (!res.ok) return;
      const data = await res.json();
      goals = data.goals || [];
      if (elGoalSelect) {
        elGoalSelect.innerHTML = goals
          .map((g) => `<option value="${esc(g.id)}">${esc(g.title)}</option>`)
          .join('');
      }
    } catch { /* silent */ }
  }

  /* ────────────────────── Render Agents Ribbon ────────────────── */
  function renderAgentsRibbon() {
    if (!elAgentsRibbon) return;
    elAgentsRibbon.innerHTML = agents
      .map((a) => {
        return `
          <div class="agent-card" id="agent-card-${esc(a.id)}">
            <span class="agent-avatar">${esc(a.avatar || '🤖')}</span>
            <div class="agent-meta">
              <span class="agent-name" style="color:${esc(a.color || 'inherit')}">${esc(a.name)}</span>
              <span class="agent-role">${esc(a.role)} · ${a.allowedTools?.length || 0} tools</span>
            </div>
          </div>`;
      })
      .join('');
  }

  function highlightThinkingAgent(agentId) {
    document.querySelectorAll('.agent-card').forEach((c) => c.classList.remove('active-thinking'));
    if (agentId) {
      document.getElementById(`agent-card-${agentId}`)?.classList.add('active-thinking');
    }
  }

  function clearThinkingAgents() {
    document.querySelectorAll('.agent-card').forEach((c) => c.classList.remove('active-thinking'));
  }

  /* ────────────────────── Render History ──────────────────────── */
  async function fetchInstances() {
    try {
      const res = await fetch('/api/swarms');
      if (!res.ok) return;
      const data = await res.json();
      instances = data.instances || [];
      renderHistoryList();
    } catch { /* silent */ }
  }

  function renderHistoryList() {
    if (!elInstancesList) return;
    if (instances.length === 0) {
      elInstancesList.innerHTML = '<div class="empty-hint">No swarms executed yet.</div>';
      return;
    }

    elInstancesList.innerHTML = instances
      .slice()
      .reverse()
      .map((inst) => {
        const isSelected = inst.id === selectedInstId;
        const dur = inst.durationMs ? `${inst.durationMs}ms` : 'active';
        const statusCls = inst.status.toLowerCase().replace(/_/g, '-');
        return `
          <div class="history-item${isSelected ? ' active' : ''}" data-id="${esc(inst.id)}">
            <div class="history-item-top">
              <span class="history-item-title">${esc(inst.goal?.title || 'Swarm Goal')}</span>
              <span class="status-pill pill-${esc(statusCls)}">${esc(inst.status)}</span>
            </div>
            <div class="history-item-meta">
              <span>${esc(inst.topology)}</span>
              <span>${esc(dur)}</span>
            </div>
          </div>`;
      })
      .join('');

    elInstancesList.querySelectorAll('.history-item').forEach((item) => {
      item.addEventListener('click', () => {
        selectInstance(item.getAttribute('data-id'));
      });
    });
  }

  async function selectInstance(instanceId) {
    if (!instanceId) return;
    selectedInstId = instanceId;
    renderHistoryList();

    try {
      const res = await fetch(`/api/swarms/${instanceId}`);
      if (!res.ok) return;
      const inst = await res.json();
      applySwarmToUI(inst);
    } catch { /* silent */ }
  }

  function applySwarmToUI(inst) {
    if (!inst) return;
    setText(elActiveTitle, inst.goal?.title || 'Swarm Execution');
    setText(elActiveMeta, `ID: ${inst.id.slice(0, 8)} · Topology: ${inst.topology} · Messages: ${inst.messages?.length || 0}`);

    const statusCls = inst.status.toLowerCase().replace(/_/g, '-');
    if (elActiveBadge) {
      elActiveBadge.textContent = inst.status;
      elActiveBadge.className = `status-pill pill-${statusCls}`;
    }

    if (elActiveControls) {
      elActiveControls.style.display = inst.status === 'RUNNING' ? 'inline-flex' : 'none';
    }

    // Render transcript
    if (elTranscriptFeed) {
      if (!inst.messages || inst.messages.length === 0) {
        elTranscriptFeed.innerHTML = '<div class="empty-hint">Deliberation in progress...</div>';
      } else {
        elTranscriptFeed.innerHTML = inst.messages.map(renderMessageBubble).join('');
        elTranscriptFeed.scrollTop = elTranscriptFeed.scrollHeight;
      }
    }

    // Render tools
    if (elToolsHistory && inst.toolInvocations) {
      elToolsHistory.innerHTML = inst.toolInvocations.map(renderToolItem).join('');
    }

    // Render verdict
    if (inst.verdict) {
      renderVerdict(inst.verdict);
    } else {
      resetVerdict();
    }
  }

  /* ─────────────────── Transcript Bubbles ─────────────────────── */
  function renderMessageBubble(msg) {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const avatar = msg.metadata?.avatar || '🤖';
    const color = msg.metadata?.color || '#3b82f6';
    const type = msg.type || 'MESSAGE';

    return `
      <div class="message-bubble">
        <div class="message-header">
          <div class="message-author">
            <span>${esc(avatar)}</span>
            <span style="color:${esc(color)}">${esc(msg.fromAgentName)}</span>
            <span class="status-pill pill-idle">${esc(type)}</span>
          </div>
          <span class="message-time">${esc(time)}</span>
        </div>
        <div class="message-content">${esc(msg.content)}</div>
      </div>`;
  }

  function appendTranscriptMessage(msg) {
    if (feedPaused || !elTranscriptFeed) return;
    elTranscriptFeed.querySelector('.empty-hint')?.remove();

    const div = document.createElement('div');
    div.innerHTML = renderMessageBubble(msg);
    elTranscriptFeed.appendChild(div.firstElementChild);
    elTranscriptFeed.scrollTop = elTranscriptFeed.scrollHeight;
  }

  /* ─────────────────── Tool History Items ─────────────────────── */
  function renderToolItem(rec) {
    const dur = `${rec.durationMs}ms`;
    return `
      <div class="tool-item">
        <div class="tool-item-header">
          <span>🛠️ ${esc(rec.toolName)}</span>
          <span style="color:var(--text-muted)">${esc(dur)}</span>
        </div>
        <div style="color:var(--text-secondary);font-size:10px">${esc(JSON.stringify(rec.args))}</div>
      </div>`;
  }

  function appendToolRecord(rec) {
    if (!elToolsHistory) return;
    elToolsHistory.querySelector('.empty-hint')?.remove();
    const div = document.createElement('div');
    div.innerHTML = renderToolItem(rec);
    elToolsHistory.insertBefore(div.firstElementChild, elToolsHistory.firstChild);
  }

  /* ─────────────────── Approvals & HITL ───────────────────────── */
  function renderApprovals(approvals) {
    if (elPendingCount) setText(elPendingCount, approvals.length);
    if (!elApprovalsList) return;

    if (!approvals || approvals.length === 0) {
      elApprovalsList.innerHTML = '<div class="empty-hint">No high-stakes actions pending sign-off.</div>';
      return;
    }

    elApprovalsList.innerHTML = approvals
      .map((app) => {
        return `
          <div class="approval-card" data-id="${esc(app.id)}">
            <span class="approval-title">⚠️ Action Requires Sign-off: ${esc(app.toolName)}</span>
            <div style="font-size:10px">${esc(JSON.stringify(app.args))}</div>
            <div class="approval-actions">
              <button class="btn-approve" onclick="resolveApproval('${esc(app.id)}', true)">✔ Approve</button>
              <button class="btn-reject" onclick="resolveApproval('${esc(app.id)}', false)">✖ Reject</button>
            </div>
          </div>`;
      })
      .join('');
  }

  window.resolveApproval = async function (id, approved) {
    try {
      await fetch(`/api/approvals/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
    } catch { /* silent */ }
  };

  /* ─────────────────── Consensus Verdict ──────────────────────── */
  function renderVerdict(verdict) {
    if (elVerdictStatus) {
      elVerdictStatus.textContent = verdict.reached ? 'CONSENSUS REACHED' : 'NO CONSENSUS';
      elVerdictStatus.className = verdict.reached ? 'status-pill pill-completed' : 'status-pill pill-failed';
    }
    if (elConfidenceScore) {
      setText(elConfidenceScore, `Confidence: ${(verdict.confidenceScore * 100).toFixed(0)}%`);
    }
    if (elVerdictSynthesis) {
      setText(elVerdictSynthesis, verdict.synthesis);
    }
  }

  function resetVerdict() {
    if (elVerdictStatus) {
      elVerdictStatus.textContent = 'AWAITING DELIBERATION';
      elVerdictStatus.className = 'status-pill pill-idle';
    }
    if (elConfidenceScore) setText(elConfidenceScore, 'Confidence: --');
    if (elVerdictSynthesis) setText(elVerdictSynthesis, 'Synthesized decision and dissenting opinions will appear upon conclusion.');
  }

  /* ─────────────────── Vector Memory Search ───────────────────── */
  if (elBtnSearchMemory && elMemorySearchInput) {
    elBtnSearchMemory.addEventListener('click', async () => {
      const q = elMemorySearchInput.value.trim();
      if (!q) return;

      try {
        const res = await fetch(`/api/memory?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const results = data.results || [];

        if (elMemoryResults) {
          if (results.length === 0) {
            elMemoryResults.innerHTML = '<div class="empty-hint">No semantic matches found above threshold.</div>';
          } else {
            elMemoryResults.innerHTML = results
              .map((r) => {
                const score = (r.similarity * 100).toFixed(1);
                return `
                  <div style="background:var(--bg-app);padding:6px 10px;border-radius:6px;font-size:11px">
                    <div style="display:flex;justify-content:space-between;font-weight:700">
                      <span>Agent: ${esc(r.entry.agentId)}</span>
                      <span style="color:var(--color-brand)">Similarity: ${score}%</span>
                    </div>
                    <div style="color:var(--text-secondary);margin-top:2px">${esc(r.entry.text)}</div>
                  </div>`;
              })
              .join('');
          }
        }
      } catch { /* silent */ }
    });
  }

  /* ─────────────────── Launch Swarm Button ────────────────────── */
  if (elBtnLaunch) {
    elBtnLaunch.addEventListener('click', async () => {
      if (isLaunching) return;

      const goalId = elGoalSelect?.value;
      let goal = goals.find((g) => g.id === goalId);

      if (elCustomTitle?.value?.trim()) {
        goal = {
          id: `custom-${Date.now()}`,
          title: elCustomTitle.value.trim(),
          description: elCustomDesc?.value?.trim() || 'Custom user goal',
          maxRounds: 4,
          requireConsensus: true,
        };
      }

      if (!goal) return;

      isLaunching = true;
      elBtnLaunch.disabled = true;
      elBtnLaunch.textContent = '⏳ Launching…';

      try {
        const topology = elTopologySelect?.value || 'COLLABORATIVE_DEBATE';
        const res = await fetch('/api/swarms/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, topology }),
        });
        const data = await res.json();
        if (data.instanceId) {
          selectedInstId = data.instanceId;
          await selectInstance(data.instanceId);
        }
      } catch (e) {
        console.error('Launch error:', e);
      } finally {
        isLaunching = false;
        elBtnLaunch.disabled = false;
        elBtnLaunch.innerHTML = '<span class="btn-icon">▶</span> Launch Swarm';
      }
    });
  }

  /* ─────────────────── Cancel Swarm Button ────────────────────── */
  if (elBtnCancelSwarm) {
    elBtnCancelSwarm.addEventListener('click', async () => {
      if (!selectedInstId) return;
      await fetch(`/api/swarms/${selectedInstId}/cancel`, { method: 'POST' });
    });
  }

  /* ─────────────────── Metrics ────────────────────────────────── */
  function updateMetrics(m) {
    if (!m) return;
    setText(elMetricSwarms, m.totalGoalsExecuted || 0);
    setText(elMetricActive, `${m.activeSwarms || 0} active`);
    setText(elMetricConsensus, `${m.consensusRate || 100}%`);
    setText(elMetricToolCalls, m.totalToolCalls || 0);
    setText(elMetricDebateTurns, m.totalDebateTurns || 0);
  }

  /* ─────────────────── Boot ──────────────────────────────────── */
  setWsStatus(false);
  initWebSocket();
})();
