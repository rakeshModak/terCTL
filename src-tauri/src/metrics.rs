use crate::ssh::{connect_host, ClientHandler};
use crate::store::Store;
use russh::client::Handle;
use russh::ChannelMsg;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex as AsyncMutex;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProcInfo {
    pub name: String,
    pub cpu: f32,
    pub mem: f32,
}

/// Live host metrics. Byte counters (`net_rx`/`net_tx`) are deltas over the
/// remote's ~1s sample window, i.e. bytes/second.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub cpu: f32,
    pub cores: u32,
    pub load: String,
    pub mem_used_kb: u64,
    pub mem_total_kb: u64,
    pub disk_used_kb: u64,
    pub disk_total_kb: u64,
    pub net_rx: u64,
    pub net_tx: u64,
    pub uptime_sec: f64,
    pub procs: Vec<ProcInfo>,
}

/// One reused SSH connection per host for metrics polling (separate from the
/// terminal PTY and the SFTP browser). Kept alive so each poll only opens a
/// cheap exec channel rather than re-authenticating.
#[derive(Default)]
pub struct MetricsManager {
    conns: AsyncMutex<HashMap<String, Arc<Handle<ClientHandler>>>>,
}

impl MetricsManager {
    async fn get(&self, store: &Store, host_id: &str) -> Result<Arc<Handle<ClientHandler>>, String> {
        if let Some(h) = self.conns.lock().await.get(host_id) {
            return Ok(h.clone());
        }
        let handle = Arc::new(connect_host(store, host_id).await?);
        self.conns
            .lock()
            .await
            .insert(host_id.to_string(), handle.clone());
        Ok(handle)
    }

    pub async fn drop_host(&self, host_id: &str) {
        self.conns.lock().await.remove(host_id);
    }
}

// One-shot Linux metrics probe: samples /proc/stat and /proc/net/dev twice with
// a 1s gap to derive CPU% and net rates, then emits a single JSON line.
const SCRIPT: &str = r#"LC_ALL=C
c1=$(awk '/^cpu /{t=0;for(i=2;i<=NF;i++)t+=$i;print t,$5}' /proc/stat)
n1=$(awk 'NR>2{gsub(/:/," ");if($1!="lo"){rx+=$2;tx+=$10}}END{print rx+0,tx+0}' /proc/net/dev)
sleep 1
c2=$(awk '/^cpu /{t=0;for(i=2;i<=NF;i++)t+=$i;print t,$5}' /proc/stat)
n2=$(awk 'NR>2{gsub(/:/," ");if($1!="lo"){rx+=$2;tx+=$10}}END{print rx+0,tx+0}' /proc/net/dev)
cpu=$(awk -v a="$c1" -v b="$c2" 'BEGIN{split(a,x," ");split(b,y," ");dt=y[1]-x[1];di=y[2]-x[2];printf "%.1f",(dt>0)?(1-di/dt)*100:0}')
net=$(awk -v a="$n1" -v b="$n2" 'BEGIN{split(a,x," ");split(b,y," ");printf "%d %d",y[1]-x[1],y[2]-x[2]}')
cores=$(nproc 2>/dev/null || awk '/^processor/{n++}END{print n+0}' /proc/cpuinfo); cores=${cores:-1}
load=$(cut -d" " -f1-3 /proc/loadavg)
mem=$(awk '/^MemTotal/{t=$2}/^MemAvailable/{a=$2}END{printf "%d %d",t-a,t}' /proc/meminfo)
disk=$(df -Pk / | awk 'NR==2{printf "%d %d",$3,$2}')
up=$(cut -d" " -f1 /proc/uptime)
procs=$(ps -eo comm=,pcpu=,pmem= --sort=-pcpu 2>/dev/null | head -5 | awk '{printf "%s{\"name\":\"%s\",\"cpu\":%s,\"mem\":%s}",(NR>1?",":""),$1,$2+0,$3+0}')
set -- $net; nrx=$1; ntx=$2
set -- $mem; mu=$1; mt=$2
set -- $disk; du=$1; dt=$2
printf '{"cpu":%s,"cores":%s,"load":"%s","memUsedKb":%s,"memTotalKb":%s,"diskUsedKb":%s,"diskTotalKb":%s,"netRx":%s,"netTx":%s,"uptimeSec":%s,"procs":[%s]}' "$cpu" "$cores" "$load" "$mu" "$mt" "$du" "$dt" "$nrx" "$ntx" "$up" "$procs"
"#;

#[tauri::command]
pub async fn ssh_metrics(
    store: State<'_, Store>,
    metrics: State<'_, MetricsManager>,
    host_id: String,
) -> Result<Metrics, String> {
    let run = || async {
        let handle = metrics.get(&store, &host_id).await?;
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel.exec(true, SCRIPT).await.map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        while let Some(msg) = channel.wait().await {
            match msg {
                ChannelMsg::Data { data } => out.extend_from_slice(&data),
                ChannelMsg::Eof | ChannelMsg::Close => break,
                _ => {}
            }
        }
        let text = String::from_utf8_lossy(&out);
        serde_json::from_str::<Metrics>(text.trim()).map_err(|e| format!("parse metrics: {e}"))
    };

    match run().await {
        Ok(m) => Ok(m),
        Err(e) => {
            // Drop a stale/broken connection so the next poll reconnects.
            metrics.drop_host(&host_id).await;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn metrics_disconnect(
    metrics: State<'_, MetricsManager>,
    host_id: String,
) -> Result<(), String> {
    metrics.drop_host(&host_id).await;
    Ok(())
}
