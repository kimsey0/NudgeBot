"use strict";

const calculateAge = require("./calculateAge");

const getForbiddenAndInactiveBranches = async function getForbiddenAndInactiveBranches(git, project, pullRequests, now) {
    const repositories = await git.getRepositories(project);
    const branchRequests = repositories.map(repository => git.getBranches(repository.id).catch(() => []));
    const branchesByRepository = await Promise.all(branchRequests);

    const allowRegex = new RegExp(`^${process.env.ALLOW_BRANCHES || ".*"}$`);
    const ignoreRegex = new RegExp(`^${process.env.IGNORE_BRANCHES || ""}$`);

    const forbiddenBranchesByRepository = branchesByRepository.map(
        branches => branches.filter(
            branch => !(allowRegex.test(branch.name) || ignoreRegex.test(branch.name))
        )
    );

    const forbiddenBranches = [].concat.apply([],
        forbiddenBranchesByRepository.map(
            (branches, index) => branches.map(
                branch => ({
                    branch: branch.name,
                    repository: repositories[index].name
                })
            )
        )
    );

    const inactiveThreshold = process.env.BRANCH_AGE_WARNING || 7 * 24;

    const isInactiveBranch = function(branch, repository) {
        if (!allowRegex.test(branch.name)) {
            return false;
        }

        if (ignoreRegex.test(branch.name)) {
            return false;
        }

        if (calculateAge(branch.commit.author.date, now) <= inactiveThreshold) {
            return false;
        }

        if (pullRequests.some(pullRequest => pullRequest.repository === repository.name && pullRequest.source == branch.name)) {
            return false;
        }

        return true;
    }

    const inactiveBranchesByRepository = branchesByRepository.map(
        (branches, index) => branches.filter(branch => isInactiveBranch(branch, repositories[index]))
    );
    
    const inactiveBranches = [].concat.apply([],
        inactiveBranchesByRepository.map((branches, index) => 
            branches.map(branch => ({
                branch: branch.name,
                age: calculateAge(branch.commit.author.date, now),
                repository: repositories[index].name
            }))
    ));

    return { 
        forbiddenBranches: forbiddenBranches,
        inactiveBranches: inactiveBranches
    };
};

module.exports = getForbiddenAndInactiveBranches;