import cluster from "cluster";
import os from "os";

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
	console.log("Master process is running");
	// Fork workers
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
} else {
	require("./worker");
}
