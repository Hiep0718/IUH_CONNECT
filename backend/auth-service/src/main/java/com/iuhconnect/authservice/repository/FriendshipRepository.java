package com.iuhconnect.authservice.repository;

import com.iuhconnect.authservice.model.Friendship;
import com.iuhconnect.authservice.model.FriendshipStatus;
import com.iuhconnect.authservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE (f.user1 = :u1 AND f.user2 = :u2) OR (f.user1 = :u2 AND f.user2 = :u1)")
    Optional<Friendship> findByUsers(@Param("u1") User u1, @Param("u2") User u2);

    List<Friendship> findByUser2AndStatus(User user2, FriendshipStatus status);

    @Query("SELECT f FROM Friendship f WHERE (f.user1 = :user OR f.user2 = :user) AND f.status = :status")
    List<Friendship> findAllUserFriendships(@Param("user") User user, @Param("status") FriendshipStatus status);
}
