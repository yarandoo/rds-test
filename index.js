var pg = require('pg');
var AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
var nextId = 10000;

function wrap(id, done){
	return function(err, result) {
		if(err) {
			return console.error('error running query', err);
		}
		console.log('Successfully inserted row:', id);
		done();
	}
}

function connectToRds(host){
	var conString = "postgres://root:longbeach@" + host + ":5432/test";
	console.log('Connecting to:', conString);
	pg.connect(conString, function(err, client, done) {
		console.log('Connected successfully.');
		if(err) {
			return console.error('error fetching client from pool', err);
		}
		for (i = 0; i < 50; i++) {
    	nextId++;
			client.query('insert into test2(col1,col2 ) values (' + nextId + ',\'Some text\' )', wrap(nextId, done));
		}
	});
}

function restoreSnapshot(newInstanceName){
	var rds = new AWS.RDS();
  var params = {
    DBInstanceIdentifier: newInstanceName, /* required */
    DBSnapshotIdentifier: 'snapshot1-test-1', /* required */
    AutoMinorVersionUpgrade: true,
    CopyTagsToSnapshot: false,
    DBInstanceClass: 'db.m3.xlarge',
    Iops: 1000,
    MultiAZ: true,
    PubliclyAccessible: true,
  };

  console.log('Restoring snapshot into:', newInstanceName)

  rds.restoreDBInstanceFromDBSnapshot(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     {
  		console.log(data);           // successful response
  		console.log('Snapshot request processed successfully');
  		describeInstance(newInstanceName);
  	}
  });
}

function describeInstance(instanceName){
	var rds = new AWS.RDS();
	rds.describeDBInstances({DBInstanceIdentifier: instanceName}, function(err, data) {
		if (err) console.log('Error connecting to RDS DescribeInstance', err, err.stack); // an error occurred
		else{
			var instanceInfo = data.DBInstances[0];
			if (instanceInfo.DBInstanceStatus === 'creating'){
				console.log('Waiting for creation of DB');
				setTimeout(describeInstance,10000, instanceName);
				return;
			}
			if (instanceInfo.DBInstanceStatus === 'modifying' && instanceInfo.PendingModifiedValues){
					console.log('Waiting for AZ to be ready');           // successful respon
					console.log('Writing and Inserting Data meanwhile...');
					var host = instanceInfo.Endpoint.Address;
					connectToRds(host);
					setTimeout(describeInstance,1000, instanceName);
					return;
			}
			console.log('Restore finished...', instanceInfo.DBInstanceStatus, instanceInfo.PendingModifiedValues, instanceInfo.Endpoint.Address );
			console.log('Restore finished', new Date());
		}
	});
}

console.log('Starting RDS test at: ', new Date());
describeInstance('new-snapshot-test-7');
//restoreSnapshot('new-snapshot-test-7');
