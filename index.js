const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

//job_hunter
// F7NrRLT1dDod7rxc

//===>MongoDB<===//

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.3pjth5o.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // ===>Database collections<===//
    const jobsCollections = client.db("jobPortal").collection("jobs");
    const applicationCollections = client
      .db("jobPortal")
      .collection("applications");

    //===>Get Jobs<===//
    app.get("/jobs", async (req, res) => {
      try {
        const cursor = jobsCollections.find();
        const result = await cursor.toArray();
        res.send({
          success: true,
          message: `Jobs are here!`,
          result,
        });
      } catch (error) {
        res.send({ success: false, message: error.code });
        // console.log(error);
      }
    });
    //===>Get Specific Jobs<===//
    app.get("/jobs/:id", async (req, res) => {
      try {
        const getId = req.params.id;
        const jobId = { _id: new ObjectId(getId) };
        const result = await jobsCollections.findOne(jobId);
        res.send({
          success: true,
          message: `Job is here of id: ${getId}`,
          result,
        });
      } catch (error) {
        res.send({ success: false, message: error.code });
        // console.log(error);
      }
    });

    //===>Post Job applications<===//
    app.post("/apply", async (req, res) => {
      try {
        const application = req.body;
        // console.log(application);
        const applicantEmail = application?.email;
        const allApplications = await applicationCollections
          .find({ email: applicantEmail })
          .toArray();
        // console.log(allApplications);
        const isApplied = allApplications.filter(
          (ap) => ap?.job_id === application?.job_id
        );
        if (isApplied?.length > 0) {
          return res.send({
            success: false,
            message: "Already Applied to this job!",
          });
        }
        const result = await applicationCollections.insertOne(application);
        // console.log(result);
        res.send({ success: true, message: "Application Sent!" });
      } catch (error) {
        res.send({ success: false, message: error.code });
        // console.log(error);
      }
    });

    //==>Get Applications<===//
    app.get("/applications", async (req, res) => {
      try {
        const { email } = req?.query;
        // console.log(email);
        const result = await applicationCollections.find({ email }).toArray();

        for (const application of result) {
          // console.log(application?.job_id);
          const query = { _id: new ObjectId(application?.job_id) };
          const job = await jobsCollections.findOne(query);
          if (job) {
            application.title = job.title;
            application.location = job.location;
            application.company = job.company;
            application.applicationDeadline = job.applicationDeadline;
            application.resume;
          }
        }
        res.send({
          success: true,
          message: "All applications loaded!",
          result,
        });
      } catch (error) {
        res.send({
          success: false,
          message: error.code,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job is falling from the sky!");
});
app.listen(port, () => {
  console.log(`Job is waiting in: ${port}`);
});
