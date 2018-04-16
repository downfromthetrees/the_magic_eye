
// async function redisTest(request, response) {
//     const tempHash = 'tempHash';
//     await redisData.setLink(tempHash);
//     const linkData = await redisData.getLink(tempHash);
//     response.send('redis value was: ' + linkData);
// };
// app.get('/getdatabase', databaseTest);


// async function redditTest(request, response) {
//     const submissions = reddit.getSubreddit('hmmm').getNew();
//     const submissionsTitles = await submissions.map(post => post.title);
//     response.send(
//         'Submissions output:' + submissionsTitles //JSON.stringify(submissions)
//     );
// }
