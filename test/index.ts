import cluster from "cluster";
import os from "os";

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
	console.log("Master process is running");
	// Fork workers
	for (let i = 0; i < 3; i++) {
		cluster.fork();
	}
} else {
	require("./worker");
}
