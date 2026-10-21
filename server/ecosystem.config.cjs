// pm2 config for the AOTD push server.
// Start:  pm2 start ecosystem.config.cjs && pm2 save
// Update: pm2 reload ecosystem.config.cjs --update-env
module.exports = {
  apps: [
    {
      name: 'aotd',
      script: 'src/index.js',
      cwd: __dirname,
      // The Node that reads this file (the one deploy.sh loads with nvm) also runs
      // the app. pm2 would otherwise use its own Node, which can be too old for
      // --env-file (needs 20.6+).
      interpreter: process.execPath,
      // Loads PORT, VAPID keys and the other settings from server/.env (Node 20.6+).
      node_args: '--env-file=.env',
      max_memory_restart: '150M',
      restart_delay: 5000,
      time: true,
    },
  ],
};
