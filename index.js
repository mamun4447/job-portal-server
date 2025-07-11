const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const cors = require("cors");
const app = express();
require("dotenv").config();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    // console.log(req.user);
    next();
  });
};

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

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const result = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });

      res
        .cookie("token", result, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

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

    //===>Post a Job<===//
    app.post("/jobs", verifyToken, async (req, res) => {
      try {
        const body = req.body;
        // console.log(body);
        const hr_Email = body?.hr_email;

        const hr_posts = await jobsCollections
          .find({ hr_email: hr_Email })
          .toArray();

        const isPosted = hr_posts?.filter(
          (post) => post?.title === body?.title
        );

        if (isPosted?.length > 0) {
          return res.send({
            success: false,
            message: "Already Posted this job!",
          });
        }

        const result = await jobsCollections.insertOne(body);

        res.send({
          success: true,
          message: "Your Job is posted successfully!",
        });
      } catch (error) {
        res.send({ success: false, message: error.code });
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
    app.post("/apply", verifyToken, async (req, res) => {
      try {
        const application = req.body;
        const jobId = application?.job_id;
        const query = { _id: new ObjectId(jobId) };
        // console.log(query);

        const applicantEmail = application?.email;
        const allApplications = await applicationCollections
          .find({ email: applicantEmail })
          .toArray();
        const isApplied = allApplications?.filter(
          (ap) => ap?.job_id === application?.job_id
        );
        if (isApplied?.length > 0) {
          return res.send({
            success: false,
            message: "Already Applied to this job!",
          });
        }
        const result = await applicationCollections.insertOne(application);
        const applicationId = result?.insertedId?.toString();
        const updateDoc = {
          $push: {
            applied: applicationId,
          },
        };
        await jobsCollections.updateOne(query, updateDoc);
        // console.log(jobsApplied);
        res.send({ success: true, message: "Application Sent!" });
      } catch (error) {
        res.send({ success: false, message: error.code });
        console.log(error);
      }
    });

    //==>Get Applications<===//
    app.get("/applications", verifyToken, async (req, res) => {
      try {
        const { email } = req?.query;

        if (req?.user?.email !== req?.query?.email) {
          return res.status(403).send({ message: "Forbiden" });
        }

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

    //===>Get Applicant Info<===//
    app.get("/applications/jobs/:job_id", verifyToken, async (req, res) => {
      try {
        const jobId = req.params.job_id;
        const query = { job_id: jobId };

        const result = await applicationCollections.find(query).toArray();
        res.send({
          success: true,
          message: "Applicants information loaded!",
          result,
        });
      } catch (error) {
        res.send({ success: false, message: error.code });
        console.log(error);
      }
    });

    app.patch("/applications/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;
        // console.log(id, data);
        const query = { _id: new ObjectId(id) };
        const updateDocs = {
          $set: {
            status: data?.status,
          },
        };
        await applicationCollections.updateOne(query, updateDocs);
        res.send({
          success: true,
          message: `This Applicant is ${data?.status}`,
        });
      } catch (error) {
        console.log(error);
        res.send({ success: false, message: error.code });
      }
    });

    //===>Get HR Posted Jobs<===//
    app.get("/allJobs", verifyToken, async (req, res) => {
      try {
        const { email } = req?.query;

        if (req?.user?.email !== req?.query?.email) {
          return res.status(403).send({ message: "Forbiden" });
        }

        const result = await jobsCollections
          .find({ hr_email: email })
          .toArray();

        res.send({
          success: true,
          message: "Your Posted Jobs are loaded!",
          result,
        });
      } catch (error) {
        // console.log(error);
        res.send({ success: false, message: error.code });
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
